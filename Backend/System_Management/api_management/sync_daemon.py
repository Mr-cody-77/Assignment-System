import time
import json
import urllib.request
import threading
import logging

logger = logging.getLogger("sync.daemon")

def run_sync_daemon():
    # Delay initial startup to let DB initialize
    time.sleep(15)
    
    from api_management.models import PendingResult, PendingTestSubmission
    from Services.Sender_Server.runtime import runtime
    
    logger.info("Sync daemon started. Monitoring SQLite for offline results and test submissions.")
    
    while True:
        try:
            db = runtime.database_server
            logger.info(f"Checking DB: {db}")
            if db:
                # 1. Sync Pending Results & Plagiarism Ingest
                count = PendingResult.objects.count()
                logger.info(f"PendingResult count: {count}")
                if count > 0:
                    logger.info(f"Sync daemon found {count} pending results.")
                    pending = PendingResult.objects.order_by('created_at').first()
                    if pending:
                        url_result = f"http://{db['ip']}:{db['port']}/api/results/push_result/"
                        url_plag = f"http://{db['ip']}:{db['port']}/api/results/plagiarism/ingest/"
                        
                        payload_data = pending.payload
                        payload_bytes = json.dumps(payload_data).encode()
                        headers = {"Content-Type": "application/json"}
                        
                        # A. Push to Results
                        req_res = urllib.request.Request(url_result, data=payload_bytes, headers=headers, method="POST")
                        success_res = False
                        try:
                            with urllib.request.urlopen(req_res, timeout=10) as response:
                                if 200 <= response.status < 300:
                                    success_res = True
                        except urllib.error.HTTPError as e:
                            # 400 = Bad Request, 401/403 = Auth/Forbidden (already submitted or invalid auth). Drop these.
                            if 400 <= e.code < 500 and e.code != 404:
                                logger.error(f"Central DB rejected sync for task {pending.task_id} with client error {e.code}. Dropping from queue.")
                                success_res = True # Drop it
                            else:
                                logger.error(f"Server error {e.code} during sync attempt for task {pending.task_id}. Will retry later.")
                        except Exception as e:
                            logger.warning(f"Network error during sync attempt: {e}")
                            
                        # B. Push to Plagiarism Ingest (only if result push didn't hard-fail on network)
                        if success_res and payload_data.get('code'):
                            plag_payload = json.dumps({
                                "roll_number": payload_data.get("roll_number"),
                                "question_id": str(payload_data.get("question_id")),
                                "language": payload_data.get("language"),
                                "code": payload_data.get("code")
                            }).encode("utf-8")
                            
                            req_plag = urllib.request.Request(url_plag, data=plag_payload, headers=headers, method="POST")
                            try:
                                with urllib.request.urlopen(req_plag, timeout=10) as response:
                                    logger.info(f"Successfully synced code for task {pending.task_id} to Plagiarism DB.")
                            except Exception as e:
                                logger.warning(f"Failed to sync code for task {pending.task_id} to Plagiarism DB: {e}")
                                
                        if success_res:
                            pending.delete()
                            logger.info(f"Successfully synced task {pending.task_id} to Central DB and deleted from local SQLite.")
                
                # 2. Sync Pending Test Submissions
                sub_count = PendingTestSubmission.objects.count()
                if sub_count > 0:
                    logger.info(f"Sync daemon found {sub_count} pending test submissions.")
                    sub = PendingTestSubmission.objects.order_by('created_at').first()
                    if sub:
                        sub_headers = {"Content-Type": "application/json"}
                        sub_payload_data = {"test_id": sub.test_id}
                        if sub.roll_number:
                            sub_payload_data["roll_number"] = sub.roll_number
                        
                        # Try JWT-authenticated sync first, fall back to roll_number-based sync
                        success_sub = False
                        
                        if sub.authorization:
                            sub_headers["Authorization"] = sub.authorization
                        
                        url_sub = f"http://{db['ip']}:{db['port']}/api/tests/sync_submit/"
                        sub_payload = json.dumps(sub_payload_data).encode()
                        req_sub = urllib.request.Request(url_sub, data=sub_payload, headers=sub_headers, method="POST")
                        try:
                            with urllib.request.urlopen(req_sub, timeout=10) as response:
                                if 200 <= response.status < 300:
                                    success_sub = True
                                    logger.info(f"Successfully synced test submission for test {sub.test_id} to Central DB.")
                        except urllib.error.HTTPError as e:
                            # 400, 401, 403: Data invalid, auth expired, or already submitted. Drop to prevent endless loop.
                            if 400 <= e.code < 500 and e.code != 404:
                                logger.error(f"Central DB rejected test submission for test {sub.test_id} with client error {e.code}. Dropping from queue.")
                                success_sub = True  # Drop it
                            else:
                                logger.warning(f"HTTP {e.code} during test submission sync for test {sub.test_id}. Will retry later.")
                        except Exception as e:
                            logger.warning(f"Network error during test submission sync: {e}")
                        
                        if success_sub:
                            sub.delete()
                            
        except Exception as e:
            logger.error(f"Sync daemon encountered unexpected error: {e}")
            
        time.sleep(10)

def start_sync_daemon():
    thread = threading.Thread(target=run_sync_daemon, daemon=True, name="SyncDaemon")
    thread.start()
