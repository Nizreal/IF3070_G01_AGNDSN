import random

from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors


def steepest_ascent(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness, rng: random.Random | None = None) -> dict:
    if rng is None:
        rng = random.Random()

    current = initial_state
    objective_history = [evaluate(current, vehicles)]
    iterations = 0

    while True:
        current_score = evaluate(current, vehicles)

        best_neighbors = []
        best_score = current_score

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            if neighbor_score > best_score:
                best_neighbors = [neighbor]
                best_score = neighbor_score
            elif neighbor_score == best_score and neighbor_score > current_score:
                best_neighbors.append(neighbor)

        if not best_neighbors:
            break

        current = rng.choice(best_neighbors)
        iterations += 1
        objective_history.append(best_score)

    return {
        "state": current,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
    }
