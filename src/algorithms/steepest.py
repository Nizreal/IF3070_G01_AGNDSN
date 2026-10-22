from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors


def steepest_ascent(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness) -> dict:
    current = initial_state
    objective_history = [evaluate(current, vehicles)]
    iterations = 0

    while True:
        current_score = evaluate(current, vehicles)

        best_neighbor = None
        best_score = current_score 

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            if (neighbor_score > best_score):
                best_neighbor = neighbor
                best_score = neighbor_score

        if (best_neighbor is None):
            break

        current = best_neighbor
        iterations += 1
        objective_history.append(best_score)

    return {
        "state": current,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
    }
