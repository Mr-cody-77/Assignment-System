import math

GOOD_SCORE_THRESHOLD = 25.0


def compute_good_score(
    cpu_usage: float,
    memory_usage: float,
    io_wait: float,
    active_workers: int,
    inflight_tasks: int,
    workers_limit: int,
) -> float:

    cpu=max(0.01,1.0-float(cpu_usage))
    mem=max(0.01,1.0-float(memory_usage))
    io=max(0.01,1.0-float(io_wait))
    workers=max(0.01,(workers_limit-active_workers)/max(workers_limit,1))
    queue=max(0.01,1.0/(1+inflight_tasks))

    return round(
        (cpu**0.35)
        *(mem**0.20)
        *(workers**0.20)
        *(queue**0.10)
        *(io**0.05)
        *100,
        2,
    )


def compute_score_from_metrics(metrics: dict) -> float:

    return compute_good_score(
        cpu_usage=metrics.get("cpu_usage",1.0),
        memory_usage=metrics.get("memory_usage",1.0),
        io_wait=metrics.get("io_wait",1.0),
        active_workers=metrics.get("active_workers",0),
        inflight_tasks=metrics.get("inflight_tasks",0),
        workers_limit=metrics.get("workers_limit",1),
    )


def get_runtime_score(runtime) -> float:

    return compute_good_score(
        cpu_usage=runtime.cpu_usage,
        memory_usage=runtime.memory_usage,
        io_wait=runtime.io_wait,
        active_workers=runtime.active_workers,
        inflight_tasks=runtime.inflight_tasks,
        workers_limit=runtime.workers_limit,
    )
