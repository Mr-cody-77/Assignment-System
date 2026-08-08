import json
import traceback
import urllib.request
import urllib.error
import threading

from Services.Sender_Server.runtime import runtime
from api_management.models import PendingResult

def queue_pending_result(result, authorization):
    task_id = result.get('task_id')
    if task_id:
        try:
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



def handle_result(result: dict,authorization: str) -> bool:

    database_server = runtime.database_server
    print("handle_result have been called")

    if not database_server:
        print("Database server not discovered. Falling back to Safe Mode queue.")
        # Fire background thread so it doesn't block worker
        threading.Thread(target=queue_pending_result, args=(result, authorization)).start()
        return True

    url = (
        f"http://{database_server['ip']}:{database_server['port']}/api/results/push_result/"
    )

    print("PUSH URL =", url)

    payload = json.dumps(
        result
    ).encode()

    try:

        req = urllib.request.Request(
            url,
            data=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": authorization,
            },
            method="POST",
        )
        print("DATABASE SERVER =", database_server)
        print("PUSH URL =", url)
        print("PAYLOAD =", result)

        with urllib.request.urlopen(
            req,
            timeout=10,
        ) as response:

            print(
                "DB RESPONSE:",
                response.status,
            )

            return (
                200
                <= response.status
                < 300
            )

    except urllib.error.HTTPError as e:

        print(
            "HTTP ERROR:",
            e.code,
        )

        try:
            print(
                e.read().decode()
            )
        except Exception:
            pass

        return False

    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        print(f"Network error pushing result: {e}. Falling back to Safe Mode queue.")
        threading.Thread(target=queue_pending_result, args=(result, authorization)).start()
        return True

    except Exception as e:
        print("EXCEPTION TYPE =", type(e))
        print("ERROR =", repr(e))
        traceback.print_exc()
        # Even on weird exceptions, queue it just in case it's network related
        threading.Thread(target=queue_pending_result, args=(result, authorization)).start()
        return True