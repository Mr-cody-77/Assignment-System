import json
import traceback
import urllib.request
import urllib.error

from Services.Sender_Server.runtime import runtime



def handle_result(result: dict,authorization: str) -> bool:

    database_server = runtime.database_server
    print("hadnle_result have been called")

    if not database_server:
        print("Database server not discovered")
        return False

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

    except Exception as e:
        print("EXCEPTION TYPE =", type(e))
        print("ERROR =", repr(e))
        traceback.print_exc()
        return False