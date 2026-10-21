from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors, random_neighbor
import math
import random

def simulated_annealing(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, initial_temperature: float = 90.0, cooling_rate: float = 0.995, max_iterations: int = 2000) -> dict:
    current = initial_state
    T = initial_temperature
    best = current
    acceptance_probability_history = []
    stuck_iterations = []
    local_optimum_cache = {}

    for iteration in range(1, max_iterations + 1):
        if (T <= 0.01) :
            return {
                "best_state": current,
                "acceptance_probability_history": acceptance_probability_history,
                "stuck_iterations": stuck_iterations,
            }
        
        previous = current
        acceptance_probability = None
        neighbor = random_neighbor(current, ship, vehicles, rng)

        if neighbor is not None:
            deltaE = evaluate(neighbor, vehicles) - evaluate(current, vehicles)

            if (deltaE > 0):
                current = neighbor
            else:
                acceptance_probability = math.exp(deltaE / T)
                if (rng.random() < acceptance_probability):
                    current = neighbor

            if (evaluate(current, vehicles) > evaluate(best, vehicles)):
                best = current

        acceptance_probability_history.append(acceptance_probability)
        if current is previous:
            key = current.key()
            if key not in local_optimum_cache:
                score = evaluate(current, vehicles)
                local_optimum_cache[key] = all(
                    evaluate(candidate, vehicles) <= score
                    for candidate in iter_neighbors(current, ship, vehicles)
                )
            if local_optimum_cache[key]:
                stuck_iterations.append(iteration)

        T *= cooling_rate

    return {
        "best_state": best,
        "acceptance_probability_history": acceptance_probability_history,
        "stuck_iterations": stuck_iterations,
    }
