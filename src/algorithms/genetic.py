import random
from time import perf_counter

from ..models import Placement, Ship, State, Vehicle
from ..neighbors import random_neighbor
from ..problem import footprint, is_valid, random_state, shipping_fee_fitness

def select_parent(population: list[State], scores: list[float], rng: random.Random) -> State:
    if sum(scores) == 0:
        return rng.choice(population)

    return rng.choices(population, weights=scores, k=1)[0]


def repair(child: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness) -> State:
    repaired = State({vehicle_id: None for vehicle_id in vehicles})
    priorities = {}

    for vehicle_id, vehicle in vehicles.items():
        priority_state = State({key: None for key in vehicles})
        priority_state.placements[vehicle_id] = child.placements[vehicle_id]
        priorities[vehicle_id] = evaluate(priority_state, vehicles)

    ordered_ids = sorted(vehicles, key=priorities.get, reverse=True)
    for vehicle_id in ordered_ids:
        placement = child.placements[vehicle_id]
        vehicle = vehicles[vehicle_id]
        alternatives = []

        for rotated in (False, True):
            width, length = footprint(vehicle, rotated)
            for y in range(ship.length - length + 1):
                for x in range(ship.width - width + 1):
                    candidate = Placement(x, y, rotated)
                    if candidate != placement:
                        alternatives.append(candidate)

        rng.shuffle(alternatives)
        candidates = []
        if placement is not None:
            candidates.append(placement)
        candidates.extend(alternatives)

        for candidate in candidates:
            repaired.placements[vehicle_id] = candidate
            if is_valid(repaired, ship, vehicles):
                break
            repaired.placements[vehicle_id] = None

    return repaired


def crossover(parent1: State, parent2: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, evaluate=shipping_fee_fitness) -> State:
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

    return repair(State(placements), ship, vehicles, rng, evaluate)


def genetic_algorithm(ship: Ship, vehicles: dict[str, Vehicle], population_size: int, iterations: int, rng: random.Random, evaluate=shipping_fee_fitness, initial_state: State | None = None) -> dict:
    started = perf_counter()
    mutation_probability = 0.1
    population = []
    if initial_state is not None:
        population.append(State(initial_state.placements.copy()))

    while len(population) < population_size:
        population.append(random_state(ship, vehicles, rng))

    scores = [evaluate(state, vehicles) for state in population]
    initial_best_index = scores.index(max(scores))
    initial_best_state = State(population[initial_best_index].placements.copy())
    final_best_state = State(initial_best_state.placements.copy())
    max_fitness_history = [max(scores)]
    avg_fitness_history = [sum(scores) / len(scores)]

    for _ in range(iterations):
        new_population = []

        while len(new_population) < population_size:
            parent1 = select_parent(population, scores, rng)
            parent2 = select_parent(population, scores, rng)
            child = crossover(parent1, parent2, ship, vehicles, rng, evaluate)

            if rng.random() < mutation_probability:
                mutated = random_neighbor(child, ship, vehicles, rng)
                if mutated is not None:
                    child = mutated

            new_population.append(child)

        population = new_population
        scores = [evaluate(state, vehicles) for state in population]
        generation_best_index = scores.index(max(scores))
        generation_best_fitness = scores[generation_best_index]
        final_best_state = State(population[generation_best_index].placements.copy())
        max_fitness_history.append(generation_best_fitness)
        avg_fitness_history.append(sum(scores) / len(scores))

    runtime_ms = (perf_counter() - started) * 1000

    return {
        "initial_state": initial_best_state,
        "best_state": final_best_state,
        "max_fitness_history": max_fitness_history,
        "avg_fitness_history": avg_fitness_history,
        "population_size": population_size,
        "iterations": iterations,
        "runtime_ms": runtime_ms,
    }
