from ..models import State, Ship, Vehicle
from ..problem import fitness
from ..neighbors import iter_neighbors
from ..monitoring.progress import ProgressCallback, emit_progress


def steepest_ascent(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=fitness, on_progress: ProgressCallback | None = None) -> State:
    current = initial_state
    iteration = 0
    started = False
    best_fitness = 0.0

    while True:
        current_score = evaluate(current, vehicles)
        if not started:
            best_fitness = current_score
            emit_progress(on_progress, iteration, "initialized", current, current_score, best_fitness)
            started = True
        iteration += 1

        best_neighbor = None
        best_score = current_score 
        neighbors_evaluated = 0

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)
            neighbors_evaluated += 1

            if (neighbor_score > best_score):
                best_neighbor = neighbor
                best_score = neighbor_score

        if (best_neighbor is None):
            emit_progress(on_progress, iteration, "stopped", current, current_score, best_fitness, {
                "termination_reason": "local optimum reached",
                "neighbors_evaluated": neighbors_evaluated,
            })
            return current

        current = best_neighbor
        best_fitness = best_score
        emit_progress(on_progress, iteration, "state_updated", current, best_score, best_fitness, {
            "improvement": best_score - current_score,
            "neighbors_evaluated": neighbors_evaluated,
        })
            
