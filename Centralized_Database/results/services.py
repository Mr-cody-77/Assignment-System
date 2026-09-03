from .models import Result
from django.db import transaction

def store_result(student, data):
    qid = str(data['question_id']).strip()
    
    with transaction.atomic():
        # Mark old results for this student and question as not latest
        Result.objects.filter(
            student=student, 
            question_id=qid
        ).select_for_update().update(is_latest=False)
        
        # Create the new result
        result = Result.objects.create(
            student=student,
            question_id=qid,
            roll_number=str(data['roll_number']).strip(),
            status=data['status'],
            score=float(data.get('score', 0)),
            passed_testcases=int(data.get('passed_testcases', 0)),
            total_testcases=int(data.get('total_testcases', 0)),
            execution_time=float(data.get('execution_time', 0)),
            emailed=False,
            is_latest=True,
        )
    return result

import logging
from django.core.mail import send_mail
from django.conf import settings
from users.models import User
from results.models import PlagiarismDetected

logger = logging.getLogger('email_daemon')

def trigger_email_daemon(schedule_id):
    from questions.models import LockdownSchedule
    try:
        schedule = LockdownSchedule.objects.get(id=schedule_id)
    except LockdownSchedule.DoesNotExist:
        return
        
    logger.info(f"Triggering email daemon for schedule ending at {schedule.end_time}")
    
    # We find all students who have a valid email set
    students = User.objects.filter(role='student').exclude(email='')
    
    for student in students:
        # 1. Fetch their results
        results = Result.objects.filter(student=student, emailed=False)
            
        # 2. Check Plagiarism status
        plagiarised_incidents = PlagiarismDetected.objects.filter(flagged_student_id=student, emailed=False)
        helped_incidents = PlagiarismDetected.objects.filter(copied_from_student_roll=student.roll_number, emailed=False)
        
        if not results.exists() and not plagiarised_incidents.exists() and not helped_incidents.exists():
            continue
        
        subject = "Your Test Results and Plagiarism Check Status"
        
        msg = f"Hello {student.username},\n\n"
        msg += "The test lockdown has ended. Here are your final results:\n\n"
        
        for res in results:
            msg += f"- Question {res.question_id}: {res.score} points (Status: {res.status}) - Test Cases Passed: {res.passed_testcases}/{res.total_testcases}\n"
            
        msg += "\n--- PLAGIARISM CHECK ---\n"
        
        if plagiarised_incidents.exists() or helped_incidents.exists():
            msg += "WARNING: Your submission was flagged by our plagiarism detection system.\n\n"
            
            if plagiarised_incidents.exists():
                msg += "You were flagged for copying code on the following questions:\n"
                for inc in plagiarised_incidents:
                    msg += f" - Question {inc.question_id} (Matched with {inc.copied_from_student_roll} at {inc.similarity_score:.0%} similarity)\n"
                    
            if helped_incidents.exists():
                msg += "Your code was matched as the source (helper) for other students on the following questions:\n"
                for inc in helped_incidents:
                    msg += f" - Question {inc.question_id} (Copied by {inc.flagged_student_id.roll_number} at {inc.similarity_score:.0%} similarity)\n"
        else:
            msg += "No plagiarism detected. Good job!\n"
            
        msg += "\nBest Regards,\nThe Assignment System Team"
        
        try:
            send_mail(
                subject=subject,
                message=msg,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[student.email],
                fail_silently=False,
            )
            logger.info(f"Sent email to {student.email} ({student.roll_number})")
            
            results.update(emailed=True)
            plagiarised_incidents.update(emailed=True)
            helped_incidents.update(emailed=True)
        except Exception as e:
            logger.error(f"Failed to send email to {student.email}: {e}")
