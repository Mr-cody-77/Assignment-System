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
                
                # Check if there are un-checked submissions
                unchecked_exists = SubmittedSolution.objects.filter(plagiarism_checked=False).exists()
                
                if unchecked_exists:
                    # Trigger LLM plagiarism daemon if not already triggered
                    lock_key = f"llm_plagiarism_lock_{schedule.id}"
                    if not cache.get(lock_key):
                        logger.info(f"Triggering LLM Plagiarism Check for {schedule.id}...")
                        cache.set(lock_key, True, timeout=86400)
                        threading.Thread(target=run_llm_plagiarism_check, args=(schedule.id,), daemon=True).start()
                else:
                    # All checked, trigger email dispatch
                    logger.info(f"Submissions checked. Triggering Email Dispatch for {schedule.id}...")
                    schedule.emails_sent = True
                    schedule.save(update_fields=['emails_sent'])
                    threading.Thread(target=trigger_email_daemon, args=(schedule.id,), daemon=True).start()

        except Exception as e:
            logger.error(f"Error in polling loop: {e}")
            
        # Sleep for 10 seconds before polling again
        time.sleep(10)

if __name__ == '__main__':
    main()
