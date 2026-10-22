import random

from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors

# Inisialisasi Function
def steepest_ascent(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness, rng: random.Random | None = None) -> dict:
    # Jika rng kosong, generate rng baru
    if rng is None:
        rng = random.Random()

    # Inisialisasi variabel
    current = initial_state
    objective_history = [evaluate(current, vehicles)]
    iterations = 0

    # Mulai looping untuk mencari state yang lebih baik
    while True:
        # Menghitung current score
        current_score = evaluate(current, vehicles)

        # Inisialisasi tempat untuk kandidat neighbors yang akan dipilih
        best_neighbors = []
        best_score = current_score

        # Cari seluruh neighbor dan hitung score nya
        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            # Catat neighbor yang lebih baik dari current state
            if neighbor_score > best_score:
                best_neighbors = [neighbor]
                best_score = neighbor_score
            elif neighbor_score == best_score and neighbor_score > current_score:
                best_neighbors.append(neighbor)

        # Stop jika tidak ada neighbor yang lebih baik dari current state
        if not best_neighbors:
            break

        # Pilih random untuk menjadi state terbaik dari kandidat neighbors yang sudah dicatat
        current = rng.choice(best_neighbors)
        iterations += 1
        # Catat 
        objective_history.append(best_score)

    return {
        "state": current,
        "iterations": iterations,
        "iteration_history": list(range(iterations + 1)),
        "objective_history": objective_history,
    }
