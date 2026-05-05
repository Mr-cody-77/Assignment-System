from flask import Flask, request, jsonify
from state import assigned_tasks, task_store, lock

app = Flask(__name__)

@app.route("/result", methods=["POST"])
def receive_result():
    data = request.json
    task_id = data["task_id"]

    with lock:
        assigned_tasks.pop(task_id, None)
        task_store.pop(task_id, None)

    print(f"Task {task_id} completed:", data)

    return jsonify({"status": "ok"})


def start_response_server(port):
    app.run(port=port, threaded=True)