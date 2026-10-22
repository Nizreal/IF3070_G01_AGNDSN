import random

from ..models import State, Ship, Vehicle
from ..problem import random_state, shipping_fee_fitness
from .steepest import steepest_ascent

# Inisialisasi Function
def random_restart(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, max_restarts: int = 100) -> dict:
    # Inisialisasi Variabel
    first_search = steepest_ascent(initial_state, ship, vehicles, evaluate, rng)
    best_state = first_search["state"]
    best_score = evaluate(best_state, vehicles)
    objective_history = first_search["objective_history"].copy()
    iteration_history = first_search["iteration_history"].copy()
    total_iterations = first_search["iterations"]
    iterations_per_restart = []

    # Loop untuk mengulangi algoritma steepest sebanyak max_restarts dengan state awal random
    for _ in range(max_restarts):
        # Generate random state lalu mencari state lebih baik menggunakan algoritma steepest
        current = random_state(ship, vehicles, rng)
        search = steepest_ascent(current, ship, vehicles, evaluate, rng)
        iterations_per_restart.append(search["iterations"])

        # Membandingkan state awal dengan best state sementara
        start_score = search["objective_history"][0]
        if start_score > best_score:
            best_state = current
            best_score = start_score
        objective_history.append(best_score)
        iteration_history.append(total_iterations)

        # Mencari score terbaik
        for score in search["objective_history"][1:]:
            total_iterations += 1
            if score > best_score:
                best_score = score
            objective_history.append(best_score)
            iteration_history.append(total_iterations)

        # Mengganti best_state jika ditemukan state yang lebih baik
        if search["objective_history"][-1] > evaluate(best_state, vehicles):
            best_state = search["state"]

    # Mengembalikan state, total iterasi yang dilakukan, restart yang dilakukan, banyak iterasi per restart, data historis iterasi, dan data historis nilai fitness
    return {
        "state": best_state,
        "iterations": total_iterations,
        "restart_count": len(iterations_per_restart),
        "iterations_per_restart": iterations_per_restart,
        "iteration_history": iteration_history,
        "objective_history": objective_history,
    }
