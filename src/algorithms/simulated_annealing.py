from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import random_neighbor
import math
import random

def simulated_annealing(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, initial_temperature: float = 90.0, cooling_rate: float = 0.995, max_iterations: int = 2000) -> State:
    current = initial_state
    T = initial_temperature
    best = current

    for _ in range(max_iterations):
        if (T <= 0) :
            return current
        
        neighbor = random_neighbor(current, ship, vehicles, rng)

        if neighbor is not None:
            deltaE = evaluate(neighbor, vehicles) - evaluate(current, vehicles)

            if (deltaE > 0):
                current = neighbor
            elif (rng.random() < math.exp(deltaE / T)):
                current = neighbor

            if (evaluate(current, vehicles) > evaluate(best, vehicles)):
                best = current

        T *= cooling_rate

    return best
