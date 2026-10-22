import random
from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import random_neighbor


def stochastic(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness, rng: random.Random | None = None, max_iterations: int = 100) -> dict:
    if rng is None:
        rng = random.Random()

    current = initial_state
    objective_history = [evaluate(current, vehicles)]
    iterations = 0

    # Looping sesuai iterasi yang ditentukan
    for _ in range(max_iterations):
        # Membuat value random neighbor
        neighbor = random_neighbor(current, ship, vehicles, rng)

        # Hasil skor prioritas neighbor dibandingkan dengan skor prioritas saat ini, current value diganti dengan neighbor
        if neighbor is not None and evaluate(neighbor, vehicles) > evaluate(current, vehicles):
            current = neighbor

        iterations += 1
        # Skor priotas terbaru direkam dan dimasukkan ke array
        objective_history.append(evaluate(current, vehicles))


    return {
        "state": current,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
    }
