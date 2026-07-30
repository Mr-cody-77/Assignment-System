import time
import logging
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from django.core.management.base import BaseCommand
from questions.models import LockdownSchedule
from users.models import User
from results.models import Result, PlagiarismDetected

logger = logging.getLogger('email_daemon')

class Command(BaseCommand):
    help = 'Daemon to send result and plagiarism emails after lockdown schedule expires'

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS("Starting email daemon..."))
        while True:
            try:
                # Find schedules that have ended and emails haven't been sent yet
                now = timezone.now()
                schedules = LockdownSchedule.objects.filter(
                    end_time__lt=now,
                    emails_sent=False
                )

                for schedule in schedules:
                    self.stdout.write(f"Processing schedule ending at {schedule.end_time}...")
                    self.send_emails_for_schedule(schedule)
                    
                    # Mark as sent
                    schedule.emails_sent = True
                    schedule.save()
                    self.stdout.write(self.style.SUCCESS(f"Finished processing schedule ending at {schedule.end_time}."))
            except Exception as e:
                logger.error(f"Error in email daemon: {e}")
            
            # Sleep before checking again
            time.sleep(30)
            
    def send_emails_for_schedule(self, schedule):
        # We find all students who have a valid email set
        students = User.objects.filter(role='student').exclude(email='')
        
        for student in students:
            # 1. Fetch their results (aggregate or list)
            results = Result.objects.filter(student=student)
            if not results.exists():
                continue # Student didn't submit anything
                
            # 2. Check Plagiarism status
            # Flagged as the one who copied
            plagiarised_incidents = PlagiarismDetected.objects.filter(flagged_student_id=student)
            
            # Flagged as the one who helped (copied_from_student_roll matches their roll_number)
            helped_incidents = PlagiarismDetected.objects.filter(copied_from_student_roll=student.roll_number)
            
            # Construct email subject and message
            subject = f"Your Test Results and Plagiarism Check Status"
            
            msg = f"Hello {student.username},\n\n"
            msg += "The test lockdown has ended. Here are your final results:\n\n"
            
            for res in results:
                msg += f"- Question {res.question_id}: {res.score} points (Status: {res.status})\n"
                
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
                self.stdout.write(f"Sent email to {student.email} ({student.roll_number})")
            except Exception as e:
                logger.error(f"Failed to send email to {student.email}: {e}")
