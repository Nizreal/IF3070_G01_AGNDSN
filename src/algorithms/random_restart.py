from ..models import State, Ship, Vehicle
from ..problem import random_state, shipping_fee_fitness
from ..neighbors import iter_neighbors
import random


def random_restart(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, max_restarts: int = 100) -> dict:
    best = initial_state
    iteration_per_search = []
    restart_count = 0

    for _ in range(max_restarts):
        current = random_state(ship, vehicles, rng)
        iteration = 0
        
        while True:
            current_score = evaluate(current, vehicles)

            best_neighbor = None
            best_score = current_score 

            for neighbor in iter_neighbors(current, ship, vehicles):
                neighbor_score = evaluate(neighbor, vehicles)
        
                if (neighbor_score > best_score):
                    best_neighbor = neighbor
                    best_score = neighbor_score
                iteration += 1
        
            if (best_neighbor is None):
                break
        
            current = best_neighbor

        if (evaluate(current, vehicles) > evaluate(best, vehicles)):
            best = current

        iteration_per_search.append(iteration)
        restart_count += 1 

    return {"best state": best, "restart_count": restart_count, "iteration_per_search": iteration_per_search, "max restarts": max_restarts}
