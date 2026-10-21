from ..models import State, Ship, Vehicle
from ..problem import random_state, shipping_fee_fitness
from .steepest import steepest_ascent
import random


def random_restart(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, max_restarts: int = 100) -> State:
    best = steepest_ascent(initial_state, ship, vehicles, evaluate)

    for _ in range(max_restarts):
        current = random_state(ship, vehicles, rng)
        result = steepest_ascent(current, ship, vehicles, evaluate)
        if (evaluate(result, vehicles) > evaluate(best, vehicles)):
            best = result

    return best
