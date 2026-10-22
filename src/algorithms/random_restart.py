import random

from ..models import State, Ship, Vehicle
from ..problem import random_state, shipping_fee_fitness
from .steepest import steepest_ascent


def random_restart(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, max_restarts: int = 100) -> dict:
    first_search = steepest_ascent(initial_state, ship, vehicles, evaluate, rng)
    best_state = first_search["state"]
    best_score = evaluate(best_state, vehicles)
    objective_history = first_search["objective_history"].copy()
    iteration_history = first_search["iteration_history"].copy()
    total_iterations = first_search["iterations"]
    iterations_per_restart = []

    for _ in range(max_restarts):
        current = random_state(ship, vehicles, rng)
        search = steepest_ascent(current, ship, vehicles, evaluate, rng)
        iterations_per_restart.append(search["iterations"])

        start_score = search["objective_history"][0]
        if start_score > best_score:
            best_state = current
            best_score = start_score
        objective_history.append(best_score)
        iteration_history.append(total_iterations)

        for score in search["objective_history"][1:]:
            total_iterations += 1
            if score > best_score:
                best_score = score
            objective_history.append(best_score)
            iteration_history.append(total_iterations)

        if search["objective_history"][-1] > evaluate(best_state, vehicles):
            best_state = search["state"]

    return {
        "state": best_state,
        "iterations": total_iterations,
        "restart_count": len(iterations_per_restart),
        "iterations_per_restart": iterations_per_restart,
        "iteration_history": iteration_history,
        "objective_history": objective_history,
    }
