import math
import random

from ..models import State, Ship, Vehicle
from ..neighbors import iter_neighbors, random_neighbor
from ..problem import shipping_fee_fitness

# Inisialisasi Function
def simulated_annealing(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness, initial_temperature: float = 90.0, cooling_rate: float = 0.995, max_iterations: int = 2000) -> dict:
    # Inisialisasi Variabel
    current = initial_state
    temperature = initial_temperature
    objective_history = [evaluate(current, vehicles)]
    eET_history = []
    stuck_iterations = []
    local_optimum_cache = {}

    # Memulai looping dengan dibatasi maks iterasi
    for iteration in range(1, max_iterations + 1):
        # Memberhentikan loop jika temperatur berada dibawah batas minimum (default: 0.01)
        if temperature <= 0.01:
            break

        # Generate random neighbor
        neighbor = random_neighbor(current, ship, vehicles, rng)

        # Berhenti jika neighbor yang digenerate kosong
        if neighbor is None:
            break

        # Menghitung deltaE
        delta = evaluate(neighbor, vehicles) - evaluate(current, vehicles)

        # Jika deltaE > 0, ganti current state dengan neighbor sekarang 
        if delta > 0:
            current = neighbor
            eET_history.append(None)
        # Jika tidak, hitung eET untuk menjadi probabilitas neighbor terpilih
        else:
            eET = math.exp(delta / temperature)
            eET_history.append(eET)
            if rng.random() < eET:
                current = neighbor

        # Hitung current_score
        current_score = evaluate(current, vehicles)

        # Mengecek apakah local optimum
        state_key = current.key()
        if state_key not in local_optimum_cache:
            local_optimum_cache[state_key] = all(
                evaluate(candidate, vehicles) <= current_score
                for candidate in iter_neighbors(current, ship, vehicles)
            )
        if local_optimum_cache[state_key]:
            stuck_iterations.append(iteration)

        # Mencatat nilai fitness
        objective_history.append(current_score)

        # Mengurangi temperature
        temperature *= cooling_rate

    # Menghitung total iterasi
    iterations = len(objective_history) - 1

    # Mengembalikan state yang terpilih, banyak iterasi, data historis iterasi, data historis nilai fitness, data historis eET. total stuck
    return {
        "state": current,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
        "eET_history": eET_history,
        "stuck_iterations": stuck_iterations,
        "stuck_count": len(stuck_iterations),
        "stuck_frequency": len(stuck_iterations) / iterations if iterations else 0,
    }
