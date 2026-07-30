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

def run_llm_plagiarism_check(schedule_id):
    """
    Background job to perform semantic plagiarism checking via LLM.
    Runs after the traditional n-gram check during the exam.
    Scans only the submissions that were NOT already flagged by the traditional engine.
    """
    try:
        schedule = LockdownSchedule.objects.get(id=schedule_id)
        
        logger.info(f"Starting LLM Plagiarism check for schedule {schedule_id}...")
        
        # Configure Gemini
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            logger.error("GEMINI_API_KEY not found in environment.")
            # We must unblock the email daemon even if LLM fails!
            SubmittedSolution.objects.filter(plagiarism_checked=False).update(plagiarism_checked=True)
            trigger_email_daemon(schedule_id)
            return

        genai.configure(api_key=api_key)
        # We use a fast, smart model
        model = genai.GenerativeModel('gemini-1.5-pro')

        # 1. Fetch all submissions that need checking
        pending_submissions = SubmittedSolution.objects.filter(plagiarism_checked=False)
        if not pending_submissions.exists():
            logger.info("No un-checked submissions found. Triggering email daemon directly.")
            trigger_email_daemon(schedule_id)
            return
        
        # 2. Group by question ID
        submissions_by_q = {}
        for sub in pending_submissions:
            if sub.question_id not in submissions_by_q:
                submissions_by_q[sub.question_id] = []
            submissions_by_q[sub.question_id].append(sub)
            
        # 3. For each question, exclude students who are ALREADY flagged for this question
        for q_id, subs in submissions_by_q.items():
            # Get already flagged student rolls for this question
            flagged_rolls = set(PlagiarismDetected.objects.filter(question_id=q_id).values_list('flagged_student_id__roll_number', flat=True))
            
            unflagged_subs = [s for s in subs if s.roll_number not in flagged_rolls]
            
            if len(unflagged_subs) < 2:
                logger.info(f"Not enough unflagged submissions to compare for Q{q_id}.")
                continue
                
            logger.info(f"Evaluating {len(unflagged_subs)} unflagged submissions for Q{q_id} using LLM...")
            
            # 4. Construct prompt
            submissions_data = []
            for s in unflagged_subs:
                submissions_data.append({
                    "roll_number": s.roll_number,
                    "code": s.code
                })
                
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
            # 5. Call LLM
            try:
                response = model.generate_content(prompt)
                response_text = response.text.strip()
                if response_text.startswith("```json"):
                    response_text = response_text[7:-3].strip()
                elif response_text.startswith("```"):
                    response_text = response_text[3:-3].strip()
                    
                matches = json.loads(response_text)
                
                # 6. Process matches
                for match in matches:
                    flagged_roll = match.get("flagged_roll")
                    copied_from = match.get("copied_from")
                    score = match.get("score", 0.0)
                    
                    if score >= 0.75:
                        try:
                            flagged_user = User.objects.get(roll_number=flagged_roll)
                            PlagiarismDetected.objects.create(
                                flagged_student_id=flagged_user,
                                copied_from_student_roll=copied_from,
                                question_id=q_id,
                                similarity_score=score
                            )
                            logger.info(f"LLM flagged {flagged_roll} copying from {copied_from} for Q{q_id} (Score: {score})")
                        except User.DoesNotExist:
                            logger.warning(f"LLM flagged unknown user {flagged_roll}.")
                            
            except Exception as e:
                logger.error(f"Error during LLM evaluation for Q{q_id}: {e}")

        # 7. Unblock email daemon by marking ALL pending as checked
        pending_submissions.update(plagiarism_checked=True)
        
        # 8. Trigger emails
        trigger_email_daemon(schedule_id)
        
    except Exception as e:
        logger.error(f"Fatal error in run_llm_plagiarism_check: {e}")
        # Failsafe: unblock emails
        SubmittedSolution.objects.filter(plagiarism_checked=False).update(plagiarism_checked=True)
        trigger_email_daemon(schedule_id)
