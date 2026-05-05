from runtime import runtime

SAFE_CPU = 0.85
SAFE_MEMORY = 0.85
SAFE_IO_WAIT = 0.10

MIN_DELTA = 0.10


def system_load_checker():
    C = runtime.cpu_usage
    M = runtime.memory_usage
    IO = runtime.io_wait

    active = runtime.active_workers
    inflight = runtime.inflight_tasks
    limit = runtime.workers_limit

    if active > 0:
        delta = max(C / active, MIN_DELTA)
    else:
        delta = MIN_DELTA

    predicted_cpu = C + (inflight * delta)

    with runtime.lock:
        inflight = runtime.inflight_tasks
        active = runtime.active_workers

        predicted_cpu = C + (inflight * delta)

        can_accept = (
            predicted_cpu + delta <= SAFE_CPU and
            M <= SAFE_MEMORY and
            IO <= SAFE_IO_WAIT and
            active < limit
        )

        if can_accept:
            runtime.inflight_tasks += 1
            return True

        return False