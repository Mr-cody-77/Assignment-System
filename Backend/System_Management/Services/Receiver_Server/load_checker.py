from Services.load_score import (
    GOOD_SCORE_THRESHOLD,
    compute_good_score,
)
from Services.Receiver_Server.runtime import runtime


def get_predicted_score() -> float:

    from Services.Receiver_Server.runtime import runtime

    with runtime.lock:

        active = max(
            runtime.active_workers,
            1,
        )

        cpu_delta = max(
            runtime.cpu_usage / active,
            0.05,
        )


        memory_delta = max(
            runtime.memory_usage / active,
            0.02,
        )

        io_delta = max(
            runtime.io_wait / active,
            0.01,
        )

        return compute_good_score(
            cpu_usage=min(
                runtime.cpu_usage + cpu_delta,
                1.0,
            ),

            memory_usage=min(
                runtime.memory_usage + memory_delta,
                1.0,
            ),
            io_wait=min(
                runtime.io_wait + io_delta,
                1.0,
            ),
            active_workers=runtime.active_workers,
            inflight_tasks=runtime.inflight_tasks + 1,
            workers_limit=runtime.workers_limit,
        )

def can_accept_next_task() -> bool:
    with runtime.lock:

        return (
            runtime.active_workers + 1
            <= runtime.workers_limit
            and get_predicted_score()
            >= GOOD_SCORE_THRESHOLD
        )