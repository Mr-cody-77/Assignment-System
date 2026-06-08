"""
api_management/services/plagiarism_pipeline.py

Async plagiarism detection trigger for the Backend Node.

This module is COMPLETELY ISOLATED from the existing distributed pipeline.
It is called AFTER submit_task() returns — in a daemon thread — so it
has zero impact on task assignment latency.

Responsibility:
  - Read the Centralized DB server address from the Sender runtime.
  - POST the student's solution to the Central DB's new plagiarism ingest
    endpoint (POST /api/results/plagiarism/ingest/).
  - The Central DB server handles all storage and comparison logic.
  - Log the result (success / failure) without raising any exception that
    could affect the parent thread.
"""

import logging
import urllib.request
import urllib.error
import json

from Services.Sender_Server.runtime import runtime as sender_runtime

logger = logging.getLogger("plagiarism.pipeline")


def trigger_plagiarism_pipeline(
    roll_number: str,
    question_id: str,
    language: str,
    code: str,
) -> None:
    """
    Fire-and-forget function meant to run inside a daemon thread.

    Sends the raw solution to the Centralized Database server's
    plagiarism ingest endpoint. All fingerprinting, comparison, and
    flagging logic runs server-side on the Central DB.

    Parameters
    ----------
    roll_number : str
        The submitting student's roll number.
    question_id : str
        The ID of the question being answered.
    language : str
        Programming language ('python', 'cpp', 'java', …).
    code : str
        The raw source code submitted by the student.
    """
    try:
        db = sender_runtime.database_server
        if not db:
            logger.warning(
                "Plagiarism pipeline: Central DB server not yet discovered "
                "— skipping for roll=%s Q%s.",
                roll_number, question_id,
            )
            return

        url = f"http://{db['ip']}:{db['port']}/api/results/plagiarism/ingest/"

        payload = json.dumps({
            "roll_number": roll_number,
            "question_id": str(question_id),
            "language": language,
            "code": code,
        }).encode("utf-8")

        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )

        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
            logger.info(
                "Plagiarism ingest OK — roll=%s Q%s | fp_len=%s comparisons=%s flagged=%s",
                roll_number,
                question_id,
                body.get("fingerprint_length", "?"),
                body.get("comparisons", "?"),
                body.get("flagged", "?"),
            )

    except urllib.error.URLError as exc:
        # Network error — do NOT re-raise; pipeline runs as daemon thread
        logger.error(
            "Plagiarism pipeline: network error for roll=%s Q%s — %s",
            roll_number, question_id, exc,
        )
    except Exception as exc:
        # Catch-all safety net — plagiarism detection must never crash the node
        logger.exception(
            "Plagiarism pipeline: unexpected error for roll=%s Q%s — %s",
            roll_number, question_id, exc,
        )
