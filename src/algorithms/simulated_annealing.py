import math
import random

from ..models import State, Ship, Vehicle
from ..neighbors import iter_neighbors, random_neighbor
from ..problem import shipping_fee_fitness


def simulated_annealing(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, initial_temperature: float = 90.0, cooling_rate: float = 0.995, max_iterations: int = 2000) -> dict:
    current = initial_state
    best = current
    best_score = evaluate(best, vehicles)
    temperature = initial_temperature
    objective_history = [best_score]
    eET_history = []
    stuck_iterations = []
    local_optimum_cache = {}

    for iteration in range(1, max_iterations + 1):
        if temperature <= 0:
            break

        neighbor = random_neighbor(current, ship, vehicles, rng)
        if neighbor is None:
            break

        delta = evaluate(neighbor, vehicles) - evaluate(current, vehicles)
        if delta > 0:
            current = neighbor
            eET_history.append(None)
        else:
            eET = math.exp(delta / temperature)
            eET_history.append(eET)
            if rng.random() < eET:
                current = neighbor

        current_score = evaluate(current, vehicles)
        if current_score > best_score:
            best = current
            best_score = current_score

        state_key = current.key()
        if state_key not in local_optimum_cache:
            local_optimum_cache[state_key] = all(
                evaluate(candidate, vehicles) <= current_score
                for candidate in iter_neighbors(current, ship, vehicles)
            )
        if local_optimum_cache[state_key]:
            stuck_iterations.append(iteration)

        objective_history.append(best_score)
        temperature *= cooling_rate

    iterations = len(objective_history) - 1
    return {
        "state": best,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
        "eET_history": eET_history,
        "stuck_iterations": stuck_iterations,
        "stuck_count": len(stuck_iterations),
        "stuck_frequency": len(stuck_iterations) / iterations if iterations else 0,
    }
