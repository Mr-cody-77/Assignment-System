import os
import sys
import time
import logging
import threading

# Configure basic logging for the standalone script
logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s: %(message)s')
logger = logging.getLogger('central_db_daemon')

def main():
    logger.info("Initializing Django environment for Central DB Daemon...")
    # Setup Django environment
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Centralized_Database.settings')
    try:
        import django
        django.setup()
    except Exception as e:
        logger.error(f"Failed to setup Django: {e}")
        sys.exit(1)
        
    from django.conf import settings
    if not settings.EMAIL_HOST_USER or not settings.EMAIL_HOST_PASSWORD:
        logger.warning("⚠️ CRITICAL WARNING: EMAIL_HOST_USER or EMAIL_HOST_PASSWORD is missing in .env!")
        logger.warning("⚠️ The email daemon will NOT be able to send result emails!")

    from django.utils import timezone
    from django.core.cache import cache
    from questions.models import LockdownSchedule
    from results.models import SubmittedSolution
    from results.services import trigger_email_daemon
    from results.llm_plagiarism import run_llm_plagiarism_check

    logger.info("Central DB Daemon started. Polling for expired lockdown schedules...")

    while True:
        try:
            # Find active schedules that have expired but haven't triggered emails yet
            schedule = LockdownSchedule.objects.filter(
                is_active=True, 
                emails_sent=False, 
                end_time__lt=timezone.now()
            ).order_by('-created_at').first()
            
            if schedule:
                logger.info(f"Lockdown {schedule.id} has ended. Processing...")

                # BUG-04 FIX: Scope the unchecked-submissions query to only
                # submissions that were created during THIS schedule's active
                # window (start_time .. end_time).  LockdownSchedule has no
                # direct FK to Question/Test, so we use the submission timestamp
                # as the scope boundary.
                #
                # Previously this query was global (no filter at all), meaning
                # a single leftover unchecked submission from ANY older test
                # caused the daemon to loop forever, permanently blocking email
                # dispatch for the current schedule.
                unchecked_exists = SubmittedSolution.objects.filter(
                    plagiarism_checked=False,
                    submitted_at__gte=schedule.start_time,
                    submitted_at__lte=schedule.end_time,
                ).exists()
                
                if unchecked_exists:
                    # Trigger LLM plagiarism daemon if not already triggered.
                    # LLM detection only runs here — AFTER lockdown ends and the
                    # internet is assumed to be back.
                    lock_key = f"llm_plagiarism_lock_{schedule.id}"
                    if not cache.get(lock_key):
                        logger.info(f"Triggering LLM Plagiarism Check for schedule {schedule.id}...")
                        cache.set(lock_key, True, timeout=86400)
                        threading.Thread(
                            target=run_llm_plagiarism_check,
                            args=(schedule.id,),
                            daemon=True,
                        ).start()
                else:
                    # All submissions for this schedule are checked; dispatch emails
                    logger.info(f"All submissions checked. Triggering Email Dispatch for schedule {schedule.id}...")
                    schedule.emails_sent = True
                    schedule.is_active = False
                    schedule.save(update_fields=['emails_sent', 'is_active'])
                    threading.Thread(
                        target=trigger_email_daemon,
                        args=(schedule.id,),
                        daemon=True,
                    ).start()
            else:
                # Fallback: No schedule is currently expiring.
                # Check if there is ANY ongoing active lockdown.
                ongoing_lockdown = LockdownSchedule.objects.filter(
                    is_active=True,
                    start_time__lte=timezone.now(),
                    end_time__gte=timezone.now()
                ).exists()

                if not ongoing_lockdown:
                    # 1. Mark any leftover unchecked solutions as checked so they don't block delivery
                    unchecked_solutions = SubmittedSolution.objects.filter(plagiarism_checked=False)
                    if unchecked_solutions.exists():
                        logger.info(f"Marking {unchecked_solutions.count()} pending solution(s) as plagiarism-checked.")
                        unchecked_solutions.update(plagiarism_checked=True)

                    # 2. Check for students with un-emailed results who have an email set
                    from users.models import User
                    from results.models import Result
                    unemailed_students = User.objects.filter(
                        role='student',
                        results__emailed=False
                    ).exclude(email='').distinct()

                    if unemailed_students.exists():
                        logger.info(f"Found {unemailed_students.count()} student(s) with un-emailed results outside lockdown. Dispatching emails...")
                        threading.Thread(
                            target=trigger_email_daemon,
                            kwargs={'schedule_id': None},
                            daemon=True,
                        ).start()

        except Exception as e:
            logger.error(f"Error in polling loop: {e}")
            
        # Sleep for 10 seconds before polling again
        time.sleep(10)

if __name__ == '__main__':
    main()
