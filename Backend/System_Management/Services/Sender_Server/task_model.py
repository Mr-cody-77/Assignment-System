import uuid


def create_task(
    roll_number: str,
    question: dict,
    language: str,
    solution: str,
    submission_id: str = "",
) -> dict:
    return {
        "task_id": str(uuid.uuid4()),
        "submission_id": submission_id,
        "roll_number": roll_number,
        "question_id": question.get("id"),
        "retries": 0,
        "data": {
            "language": language,
            "code": solution,
            "title": question.get(
                "title",
                "",
            ),
            "description": question.get(
                "description",
                "",
            ),
            "constraints": question.get(
                "constraints",
                "",
            ),
            "examples": question.get(
                "examples",
                [],
            ),
            "test_cases": question.get(
                "test_cases",
                [],
            ),
            "hidden_test_cases": question.get(
                "hidden_test_cases",
                [],
            ),
            "time_limit_ms": question.get(
                "time_limit_ms",
                2000,
            ),
            "memory_limit_mb": question.get(
                "memory_limit_mb",
                256,
            ),
            "max_score": question.get(
                "max_score",
                100,
            ),
        },
    }