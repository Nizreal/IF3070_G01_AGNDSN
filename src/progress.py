from collections.abc import Callable

from .models import State


ProgressCallback = Callable[[dict], None]


def emit_progress(on_progress: ProgressCallback | None, iteration: int, event_type: str, state: State, current_fitness: float, best_fitness: float, metadata: dict | None = None) -> None:
    if on_progress is None:
        return

    event = {
        "iteration": iteration,
        "event_type": event_type,
        "state": State(state.placements.copy()),
        "current_fitness": current_fitness,
        "best_fitness": best_fitness,
        "metadata": dict(metadata or {}),
    }
    on_progress(event)
