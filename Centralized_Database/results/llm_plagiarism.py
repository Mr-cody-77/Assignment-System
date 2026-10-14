import json
import logging
import os
import google.generativeai as genai
from django.conf import settings
from results.models import SubmittedSolution, PlagiarismDetected
from questions.models import LockdownSchedule
from results.services import trigger_email_daemon
from users.models import User

logger = logging.getLogger('plagiarism.llm')

# Maximum number of student submissions to bundle into a single LLM prompt.
# Keeps the request well below the model's context window regardless of class size.
_MAX_BATCH_SIZE = 20


def run_llm_plagiarism_check(schedule_id):
    """
    Background job to perform semantic plagiarism checking via LLM.
    Runs after the lockdown period ends and the internet is back.
    Scans only the submissions that were NOT already flagged by the
    traditional n-gram fingerprint engine.

    BUG-05 FIX (two issues fixed):
      1. pending_submissions is now scoped to the current schedule's
         time window so submissions from other tests are never touched.
      2. Each question's submissions are processed in batches capped at
         _MAX_BATCH_SIZE to avoid exceeding the LLM's token limit.
         If a batch fails, only that batch is logged as an error — the
         rest are still processed.  The failsafe only marks submissions
         from THIS schedule as checked, never touching other tests.
    """
    try:
        schedule = LockdownSchedule.objects.get(id=schedule_id)
        
        logger.info(f"Starting LLM Plagiarism check for schedule {schedule_id}...")
        
        # Configure Gemini
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found in environment.")
            # Unblock the email daemon, but only for THIS schedule's submissions
            _mark_schedule_checked(schedule)
            trigger_email_daemon(schedule_id)
            return

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-pro')

        # 1. Fetch all submissions that need checking — scoped to this schedule
        # BUG-05 FIX: Filter by the schedule's time window, not globally.
        pending_submissions = SubmittedSolution.objects.filter(
            plagiarism_checked=False,
            submitted_at__gte=schedule.start_time,
            submitted_at__lte=schedule.end_time,
        )

        if not pending_submissions.exists():
            logger.info("No un-checked submissions found for this schedule. Triggering email daemon directly.")
            trigger_email_daemon(schedule_id)
            return
        
        # 2. Group by question ID
        submissions_by_q = {}
        for sub in pending_submissions:
            if sub.question_id not in submissions_by_q:
                submissions_by_q[sub.question_id] = []
            submissions_by_q[sub.question_id].append(sub)
            
        # 3. For each question, process unflagged submissions in batches
        for q_id, subs in submissions_by_q.items():
            # Get already flagged student rolls for this question
            flagged_rolls = set(
                PlagiarismDetected.objects.filter(question_id=q_id)
                .values_list('flagged_student_id__roll_number', flat=True)
            )
            
            unflagged_subs = [s for s in subs if s.roll_number not in flagged_rolls]
            
            if len(unflagged_subs) < 2:
                logger.info(f"Not enough unflagged submissions to compare for Q{q_id}.")
                continue
                
            logger.info(f"Evaluating {len(unflagged_subs)} unflagged submissions for Q{q_id} using LLM...")

            # BUG-05 FIX: Process in batches to avoid token limit overflow.
            # Previously all submissions were bundled into one giant prompt,
            # which would silently fail for medium/large classes and then mark
            # ALL submissions as checked via the bare except block.
            for batch_start in range(0, len(unflagged_subs), _MAX_BATCH_SIZE):
                batch = unflagged_subs[batch_start: batch_start + _MAX_BATCH_SIZE]
                _evaluate_batch(model, q_id, batch)

        # 4. Mark all submissions for THIS schedule as checked
        # BUG-05 FIX: Scoped update — only touches submissions within this
        # schedule's time window, never submissions from other tests.
        _mark_schedule_checked(schedule)
        
        # 5. Trigger emails
        trigger_email_daemon(schedule_id)
        
    except Exception as e:
        logger.error(f"Fatal error in run_llm_plagiarism_check: {e}")
        # Failsafe: unblock emails only for THIS schedule's submissions
        try:
            schedule = LockdownSchedule.objects.get(id=schedule_id)
            _mark_schedule_checked(schedule)
        except Exception:
            pass
        trigger_email_daemon(schedule_id)


def _mark_schedule_checked(schedule):
    """
    Mark all SubmittedSolution records that fall within this schedule's
    time window as plagiarism_checked=True.

    This is deliberately scoped so submissions from other tests/schedules
    are never affected (BUG-05 FIX).
    """
    updated = SubmittedSolution.objects.filter(
        plagiarism_checked=False,
        submitted_at__gte=schedule.start_time,
        submitted_at__lte=schedule.end_time,
    ).update(plagiarism_checked=True)
    logger.info(f"Marked {updated} submission(s) as plagiarism_checked for schedule {schedule.id}.")


def _evaluate_batch(model, q_id, batch):
    """
    Send one batch of submissions to the LLM and store any detected pairs.
    Errors in a single batch are logged but do not abort the whole check.
    """
    submissions_data = [
        {"roll_number": s.roll_number, "code": s.code}
        for s in batch
    ]

    prompt = f"""
You are an expert computer science professor evaluating student code for plagiarism.
These submissions evaded basic structural checks (meaning they don't look exactly the same structurally). 
Your task is to perform a deep semantic analysis to find any disguised plagiarism (e.g., refactored logic, renamed variables, swapped loops, translated constructs).

Important:
1. Ignore superficial similarities that arise simply because the problem has an obvious, standard solution.
2. Only flag a pair if you are highly confident one was copied/derived from the other (e.g., highly unusual logic shared, identical hidden bugs, exact same sequence of complex non-standard operations).
3. If you find a plagiarized pair, determine a semantic similarity score from 0.0 to 1.0 (only output if >= 0.75).

Input Submissions JSON:
{json.dumps(submissions_data, indent=2)}

Output strictly valid JSON in the following format (and nothing else, no markdown formatting):
[
  {{
    "flagged_roll": "...",
    "copied_from": "...",
    "score": 0.85
  }}
]
If no plagiarism is found, output: []
"""
    try:
        response = model.generate_content(prompt)
        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:-3].strip()
        elif response_text.startswith("```"):
            response_text = response_text[3:-3].strip()
            
        matches = json.loads(response_text)
        
        for match in matches:
            flagged_roll = match.get("flagged_roll")
            copied_from = match.get("copied_from")
            score = match.get("score", 0.0)
            
            if score >= 0.75:
                try:
                    flagged_user = User.objects.get(roll_number=flagged_roll)
                    PlagiarismDetected.objects.update_or_create(
                        question_id=q_id,
                        flagged_student_id=flagged_user,
                        copied_from_student_roll=copied_from,
                        defaults={
                            'similarity_score': score,
                            'emailed': False
                        }
                    )
                    logger.info(f"LLM flagged {flagged_roll} copying from {copied_from} for Q{q_id} (Score: {score})")
                except User.DoesNotExist:
                    logger.warning(f"LLM flagged unknown user {flagged_roll}.")
                    
    except Exception as e:
        # Log and continue — a single batch failure should not abort the whole check
        logger.error(f"Error during LLM batch evaluation for Q{q_id} (batch size {len(batch)}): {e}")
