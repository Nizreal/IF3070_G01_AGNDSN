from ..models import State, Ship, Vehicle
from ..problem import fitness
from ..neighbors import iter_neighbors
from ..progress import ProgressCallback, emit_progress


def sideways(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=fitness, on_progress: ProgressCallback | None = None) -> State:
    current = initial_state
    sideways_max_iterate = 50
    iterate_count = 0
    iteration = 0
    consecutive_sideways_moves = 0
    started = False
    visited_states = set()
    visited_states.add(current.key())

    while True:
        current_score = evaluate(current, vehicles)
        if not started:
            emit_progress(on_progress, iteration, "initialized", current, current_score, current_score, {
                "max_sideways_moves": sideways_max_iterate,
            })
            started = True

        best_neighbor = None
        best_score = current_score 
        neighbors_evaluated = 0

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)
            neighbors_evaluated += 1

            if neighbor_score == current_score and neighbor.key() in visited_states:
                continue

            if (neighbor_score >= best_score):
                best_neighbor = neighbor
                best_score = neighbor_score

        if (best_score > current_score):
            iterate_count = 0
            consecutive_sideways_moves = 0
        else :
            iterate_count += 1

        if best_neighbor is None:
            iteration += 1
            emit_progress(on_progress, iteration, "stopped", current, current_score, current_score, {
                "termination_reason": "no unvisited valid neighbor",
                "consecutive_sideways_moves": consecutive_sideways_moves,
                "sideways_limit_counter": iterate_count,
                "max_sideways_moves": sideways_max_iterate,
                "neighbors_evaluated": neighbors_evaluated,
            })
            return current

        if iterate_count >= sideways_max_iterate:
            iteration += 1
            emit_progress(on_progress, iteration, "stopped", current, current_score, current_score, {
                "termination_reason": "sideways move limit reached",
                "consecutive_sideways_moves": consecutive_sideways_moves,
                "sideways_limit_counter": iterate_count,
                "max_sideways_moves": sideways_max_iterate,
                "neighbors_evaluated": neighbors_evaluated,
            })
            return current

        move_type = "improved" if best_score > current_score else "sideways"
        if move_type == "sideways":
            consecutive_sideways_moves += 1
        current = best_neighbor
        visited_states.add(current.key())
        iteration += 1
        emit_progress(on_progress, iteration, "state_updated", current, best_score, best_score, {
            "move_type": move_type,
            "improvement": best_score - current_score,
            "consecutive_sideways_moves": consecutive_sideways_moves,
            "sideways_limit_counter": iterate_count,
            "max_sideways_moves": sideways_max_iterate,
            "neighbors_evaluated": neighbors_evaluated,
        })
            
