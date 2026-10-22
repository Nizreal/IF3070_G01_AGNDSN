from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors


def sideways(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness, max_sideways_moves: int = 10000) -> dict:
    current = initial_state
    objective_history = [evaluate(current, vehicles)]
    iterations = 0
    sideways_moves = 0
    visited_states = set()
    visited_states.add(current.key())

    while True:
        current_score = evaluate(current, vehicles)

        best_neighbor = None
        best_score = current_score 

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            if neighbor_score == current_score and neighbor.key() in visited_states:
                continue

            if (neighbor_score >= best_score):
                best_neighbor = neighbor
                best_score = neighbor_score

        if best_neighbor is None:
            break

        current = best_neighbor
        iterations += 1
        objective_history.append(best_score)
        visited_states.add(current.key())

        if best_score == current_score:
            sideways_moves += 1
        else:
            sideways_moves = 0

        if sideways_moves >= max_sideways_moves:
            break

    return {
        "state": current,
        "iterations": iterations,
        "sideways_moves": sideways_moves,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
    }
