import random
from time import perf_counter

from ..models import Ship, State, Vehicle
from ..neighbors import random_neighbor
from ..problem import is_valid, random_state, shipping_fee_fitness


def select_parent(population: list[State], scores: list[float], rng: random.Random) -> State:
    if sum(scores) == 0:
        return rng.choice(population)

    return rng.choices(population, weights=scores, k=1)[0]


def repair(child: State, ship: Ship, vehicles: dict[str, Vehicle]) -> State:
    repaired = State({vehicle_id: None for vehicle_id in vehicles})

    for vehicle_id in vehicles:
        placement = child.placements[vehicle_id]
        if placement is None:
            continue

        repaired.placements[vehicle_id] = placement
        if not is_valid(repaired, ship, vehicles):
            repaired.placements[vehicle_id] = None

    return repaired


def crossover(parent1: State, parent2: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random) -> State:
    vehicle_ids = list(vehicles)
    if len(vehicle_ids) < 2:
        return State(parent1.placements.copy())

    cut = rng.randrange(1, len(vehicle_ids))
    placements = {}

    for index, vehicle_id in enumerate(vehicle_ids):
        if index < cut:
            placements[vehicle_id] = parent1.placements[vehicle_id]
        else:
            placements[vehicle_id] = parent2.placements[vehicle_id]

    return repair(State(placements), ship, vehicles)


def genetic_algorithm(ship: Ship, vehicles: dict[str, Vehicle], population_size: int, iterations: int, rng: random.Random, evaluate=shipping_fee_fitness, initial_state: State | None = None) -> dict:
    started = perf_counter()
    mutation_probability = 0.1
    population = []
    if initial_state is not None:
        if not is_valid(initial_state, ship, vehicles):
            raise ValueError("Initial state invalid.")
        population.append(State(initial_state.placements.copy()))

    while len(population) < population_size:
        population.append(random_state(ship, vehicles, rng))

    scores = [evaluate(state, vehicles) for state in population]
    initial_best_index = scores.index(max(scores))
    initial_best_state = State(population[initial_best_index].placements.copy())
    best_state = State(initial_best_state.placements.copy())
    best_fitness = scores[initial_best_index]
    max_fitness_history = [max(scores)]
    average_fitness_history = [sum(scores) / len(scores)]

    for _ in range(iterations):
        new_population = []

        while len(new_population) < population_size:
            parent1 = select_parent(population, scores, rng)
            parent2 = select_parent(population, scores, rng)
            child = crossover(parent1, parent2, ship, vehicles, rng)

            if rng.random() < mutation_probability:
                mutated = random_neighbor(child, ship, vehicles, rng)
                if mutated is not None:
                    child = mutated

            new_population.append(child)

        population = new_population
        scores = [evaluate(state, vehicles) for state in population]
        generation_best_index = scores.index(max(scores))
        generation_best_fitness = scores[generation_best_index]
        max_fitness_history.append(generation_best_fitness)
        average_fitness_history.append(sum(scores) / len(scores))

        if generation_best_fitness > best_fitness:
            best_state = State(population[generation_best_index].placements.copy())
            best_fitness = generation_best_fitness

    runtime_ms = (perf_counter() - started) * 1000

    return {
        "initial_state": initial_best_state,
        "best_state": best_state,
        "max_fitness_history": max_fitness_history,
        "average_fitness_history": average_fitness_history,
        "population_size": population_size,
        "iterations": iterations,
        "runtime_ms": runtime_ms,
    }
