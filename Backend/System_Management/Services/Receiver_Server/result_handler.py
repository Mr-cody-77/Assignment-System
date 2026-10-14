import json
import traceback
import urllib.request
import urllib.error
import threading
from Services.Sender_Server.runtime import runtime
from api_management.models import PendingResult, sqlite_lock

# BUG-02 FIX: Serialize all SQLite writes through a shared lock.
# SQLite allows only one writer at a time; concurrent offline submissions from
# multiple students would previously collide and raise OperationalError:
# database is locked, silently dropping those submissions.


def queue_pending_result(result, authorization):
    task_id = result.get('task_id')
    if task_id:
        try:
            with sqlite_lock:
                PendingResult.objects.update_or_create(
                    task_id=str(task_id),
                    defaults={
                        "payload": result,
                        "authorization": authorization
                    }
                )
            print(f"Result for task {task_id} successfully queued in Safe Mode SQLite DB.")
        except Exception as e:
            print(f"Failed to queue pending result: {e}")


def handle_result(result: dict, authorization: str) -> bool:

    database_server = runtime.database_server
    print("handle_result have been called")

    if not database_server:
        print("Database server not discovered. Falling back to Safe Mode queue.")
        # Fire background daemon thread so it doesn't block worker
        threading.Thread(
            target=queue_pending_result,
            args=(result, authorization),
            daemon=True,
        ).start()
        return True

    url = (
        f"http://{database_server['ip']}:{database_server['port']}/api/results/push_result/"
    )

    print("PUSH URL =", url)

    payload = json.dumps(result).encode()

    try:

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
            },
            method="POST",
        )
        print("DATABASE SERVER =", database_server)
        print("PUSH URL =", url)
        print("PAYLOAD =", result)

        with urllib.request.urlopen(req, timeout=10) as response:

            print("DB RESPONSE:", response.status)

            success = 200 <= response.status < 300

            # BUG-01 FIX: Also ingest the submitted code into the plagiarism
            # store so the post-lockdown LLM engine has data to analyse.
            # This mirrors what sync_daemon.py already does for offline results.
            #
            # IMPORTANT: The ingest endpoint only STORES the raw code and builds
            # a structural fingerprint (n-gram Jaccard).  It does NOT run the
            # LLM-based plagiarism detection — that is triggered exclusively by
            # central_db_daemon.py AFTER the lockdown period ends and the
            # network is back with internet connectivity.
            if success and result.get('code'):
                _ingest_plagiarism_async(result, database_server)

            return success

    except urllib.error.HTTPError as e:

        print("HTTP ERROR:", e.code)

        try:
            print(e.read().decode())
        except Exception:
            pass

        # If it's a 404 or 5xx, it might be hitting the wrong endpoint.
        # Queue it in Safe Mode so it doesn't get lost!
        if e.code == 404 or e.code >= 500:
            print(f"HTTP error {e.code} pushing result. Falling back to Safe Mode queue.")
            threading.Thread(
                target=queue_pending_result,
                args=(result, authorization),
                daemon=True,
            ).start()
            return True

        return False

    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        print(f"Network error pushing result: {e}. Falling back to Safe Mode queue.")
        threading.Thread(
            target=queue_pending_result,
            args=(result, authorization),
            daemon=True,
        ).start()
        return True

    except Exception as e:
        print("EXCEPTION TYPE =", type(e))
        print("ERROR =", repr(e))
        traceback.print_exc()
        # Even on weird exceptions, queue it just in case it's network related
        threading.Thread(
            target=queue_pending_result,
            args=(result, authorization),
            daemon=True,
        ).start()
        return True


def _ingest_plagiarism_async(result: dict, database_server: dict):
    """
    Fire-and-forget: push the submitted code to the plagiarism ingest endpoint
    in a background daemon thread so it never blocks the main result handler.

    The ingest endpoint only STORES the raw code and generates a structural
    fingerprint (n-gram Jaccard).  The actual LLM-based plagiarism *detection*
    is triggered separately by central_db_daemon.py after the lockdown period
    ends and internet connectivity is restored.  Calling this function does NOT
    run plagiarism detection immediately.
    """
    def _do_ingest():
        try:
            url_plag = (
                f"http://{database_server['ip']}:{database_server['port']}"
                f"/api/results/plagiarism/ingest/"
            )
            plag_payload = json.dumps({
                "roll_number": result.get("roll_number"),
                "question_id": str(result.get("question_id", "")),
                "language":    result.get("language", "python"),
                "code":        result.get("code"),
            }).encode("utf-8")

            req_plag = urllib.request.Request(
                url_plag,
                data=plag_payload,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req_plag, timeout=10) as resp:
                print(f"Plagiarism ingest OK for task {result.get('task_id')}: {resp.status}")
        except Exception as exc:
            # Non-fatal: ingest failure does not affect result storage
            print(f"Plagiarism ingest failed for task {result.get('task_id')}: {exc}")

    threading.Thread(target=_do_ingest, daemon=True, name="plag-ingest").start()