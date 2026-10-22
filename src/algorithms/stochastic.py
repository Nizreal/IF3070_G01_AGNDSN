import random
from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors


def stochastic(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness, rng: random.Random | None = None) -> dict:
    if rng is None:
        rng = random.Random()

    current = initial_state
    objective_history = [evaluate(current, vehicles)]
    iterations = 0

    while True:
        current_score = evaluate(current, vehicles)

        improves_neighbors = []

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            if neighbor_score > current_score:
                improves_neighbors.append(neighbor)

        if not improves_neighbors:
            break

        current = rng.choice(improves_neighbors)
        iterations += 1
        objective_history.append(evaluate(current, vehicles))

    return {
        "state": current,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
    }
