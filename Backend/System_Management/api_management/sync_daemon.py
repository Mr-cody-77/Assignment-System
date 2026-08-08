import time
import json
import urllib.request
import threading
import logging

logger = logging.getLogger("sync.daemon")

def run_sync_daemon():
    # Delay initial startup to let DB initialize
    time.sleep(15)
    
    from api_management.models import PendingResult
    from Services.Sender_Server.runtime import runtime
    
    logger.info("Sync daemon started. Monitoring SQLite for offline results.")
    
    while True:
        try:
            count = PendingResult.objects.count()
            if count > 0:
                logger.info(f"Sync daemon found {count} pending results in Safe Mode SQLite DB.")
                
                db = runtime.database_server
                if db:
                    url = f"http://{db['ip']}:{db['port']}/api/results/push_result/"
                    
                    # Get the oldest pending result
                    pending = PendingResult.objects.order_by('created_at').first()
                    if pending:
                        payload = json.dumps(pending.payload).encode()
                        headers = {"Content-Type": "application/json"}
                        if pending.authorization:
                            headers["Authorization"] = pending.authorization
                            
                        req = urllib.request.Request(url, data=payload, headers=headers, method="POST")
                        
                        try:
                            with urllib.request.urlopen(req, timeout=10) as response:
                                if 200 <= response.status < 300:
                                    # Successfully synced! Delete from SQLite to guarantee no duplicates
                                    pending.delete()
                                    logger.info(f"Successfully synced task {pending.task_id} to Central DB and deleted from local SQLite.")
                                else:
                                    logger.error(f"Central DB rejected sync for task {pending.task_id} with status {response.status}. Will retry later.")
                        except Exception as e:
                            logger.warning(f"Network error during sync attempt: {e}. Will retry later.")
                else:
                    # Database server not discovered yet, sleep and wait
                    pass
        except Exception as e:
            logger.error(f"Sync daemon encountered unexpected error: {e}")
            
        time.sleep(15)

def start_sync_daemon():
    threading.Thread(target=run_sync_daemon, daemon=True).start()
