import time
import json
import urllib.request
import threading
import logging

logger = logging.getLogger("sync.daemon")

def run_sync_daemon():
    # Delay initial startup to let DB and network discovery initialize
    time.sleep(15)
    
    from api_management.models import PendingResult, PendingTestSubmission, sqlite_lock
    from Services.Sender_Server.runtime import runtime
    
    logger.info("Sync daemon started. Monitoring SQLite for offline results and test submissions.")
    
    while True:
        try:
            db = runtime.database_server
            if db and db.get("ip") and db.get("port"):
                # ── 1. Batch Sync Pending Results & Plagiarism Ingest ──────
                pending_results = list(PendingResult.objects.order_by('created_at').all())
                if pending_results:
                    logger.info(f"Sync daemon found {len(pending_results)} pending student results. Starting batch sync...")
                    url_result = f"http://{db['ip']}:{db['port']}/api/results/push_result/"
                    url_plag = f"http://{db['ip']}:{db['port']}/api/results/plagiarism/ingest/"
                    headers = {"Content-Type": "application/json"}

                    for pending in pending_results:
                        payload_data = pending.payload
                        payload_bytes = json.dumps(payload_data).encode("utf-8")
                        
                        # A. Push result to Central DB
                        req_res = urllib.request.Request(url_result, data=payload_bytes, headers=headers, method="POST")
                        success_res = False
                        network_break = False

                        try:
                            with urllib.request.urlopen(req_res, timeout=10) as response:
                                if 200 <= response.status < 300:
                                    success_res = True
                        except urllib.error.HTTPError as e:
                            # 400: Bad Request, 401/403: Invalid/Forbidden -> discard invalid item to prevent stuck queue
                            if 400 <= e.code < 500 and e.code != 404:
                                logger.error(f"Central DB rejected task {pending.task_id} with client error {e.code}. Dropping from queue.")
                                success_res = True  # Discard from SQLite queue
                            else:
                                logger.error(f"Server error {e.code} during sync for task {pending.task_id}. Will retry later.")
                                network_break = True
                        except Exception as e:
                            logger.warning(f"Network error during result sync attempt: {e}")
                            network_break = True

                        if network_break:
                            # Network to Central DB lost mid-batch; stop and retry next cycle
                            break

                        # B. Ingest code into Central DB Plagiarism store (for post-lockdown LLM analysis)
                        if success_res and payload_data.get('code'):
                            plag_payload = json.dumps({
                                "roll_number": payload_data.get("roll_number"),
                                "question_id": str(payload_data.get("question_id", "")),
                                "language": payload_data.get("language", "python"),
                                "code": payload_data.get("code")
                            }).encode("utf-8")
                            
                            req_plag = urllib.request.Request(url_plag, data=plag_payload, headers=headers, method="POST")
                            try:
                                with urllib.request.urlopen(req_plag, timeout=10) as response:
                                    logger.info(f"Successfully synced code for task {pending.task_id} to Plagiarism DB.")
                            except Exception as e:
                                logger.warning(f"Failed to sync code for task {pending.task_id} to Plagiarism DB: {e}")

                        # C. Clear the student result record from SQLite local storage
                        if success_res:
                            with sqlite_lock:
                                pending.delete()
                            logger.info(f"Successfully synced task {pending.task_id} to Central DB and removed from local SQLite.")

                # ── 2. Batch Sync Pending Test Submissions ─────────────────
                pending_subs = list(PendingTestSubmission.objects.order_by('created_at').all())
                if pending_subs:
                    logger.info(f"Sync daemon found {len(pending_subs)} pending test submissions. Starting batch sync...")
                    url_sub = f"http://{db['ip']}:{db['port']}/api/tests/sync_submit/"

                    for sub in pending_subs:
                        sub_headers = {"Content-Type": "application/json"}
                        if sub.authorization:
                            sub_headers["Authorization"] = sub.authorization

                        sub_payload_data = {"test_id": sub.test_id}
                        if sub.roll_number:
                            sub_payload_data["roll_number"] = sub.roll_number

                        sub_payload = json.dumps(sub_payload_data).encode("utf-8")
                        req_sub = urllib.request.Request(url_sub, data=sub_payload, headers=sub_headers, method="POST")
                        success_sub = False
                        sub_network_break = False

                        try:
                            with urllib.request.urlopen(req_sub, timeout=10) as response:
                                if 200 <= response.status < 300:
                                    success_sub = True
                                    logger.info(f"Successfully synced test submission for test {sub.test_id} (student: {sub.roll_number}) to Central DB.")
                        except urllib.error.HTTPError as e:
                            # 400, 401, 403: Data invalid, auth expired, or already submitted -> drop to prevent endless retry
                            if 400 <= e.code < 500 and e.code != 404:
                                logger.error(f"Central DB rejected test submission for test {sub.test_id} with client error {e.code}. Dropping from queue.")
                                success_sub = True
                            else:
                                logger.warning(f"HTTP {e.code} during test submission sync for test {sub.test_id}. Will retry later.")
                                sub_network_break = True
                        except Exception as e:
                            logger.warning(f"Network error during test submission sync: {e}")
                            sub_network_break = True

                        if sub_network_break:
                            break

                        if success_sub:
                            with sqlite_lock:
                                sub.delete()
                            logger.info(f"Removed synced test submission {sub.test_id} from local SQLite.")

        except Exception as e:
            logger.error(f"Sync daemon encountered unexpected error: {e}")
            
        time.sleep(10)

def start_sync_daemon():
    thread = threading.Thread(target=run_sync_daemon, daemon=True, name="SyncDaemon")
    thread.start()
