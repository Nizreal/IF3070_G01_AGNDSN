import random
from time import perf_counter

from .algorithms.random_restart import random_restart
from .algorithms.simulated_annealing import simulated_annealing
from .algorithms.sideways import sideways
from .algorithms.steepest import steepest_ascent
from .algorithms.stochastic import stochastic
from .algorithms.genetic import genetic_algorithm
from .models import State, Ship, Vehicle
from .problem import eta_fitness, is_valid, random_state, shipping_fee_fitness


ALGORITHMS = {
    "steepest": {"name": "Steepest-Ascent Hill Climbing", "function": steepest_ascent},
    "stochastic": {"name": "Stochastic Hill Climbing", "function": stochastic},
    "sideways": {"name": "Hill Climbing with Sideways Moves", "function": sideways},
    "random_restart": {"name": "Random-Restart Hill Climbing", "function": random_restart},
    "annealing": {"name": "Simulated Annealing", "function": simulated_annealing},
    "genetic": {"name": "Genetic Algorithm", "function": genetic_algorithm},
}


def serialize_state(state: State) -> dict:
    placements = {}
    for vehicle_id, placement in state.placements.items():
        if placement is None:
            placements[vehicle_id] = None
        else:
            placements[vehicle_id] = {"x": placement.x, "y": placement.y, "rotated": placement.rotated}

    return {"placements": placements}


def problem_metrics(state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate) -> dict:
    loaded = [vehicle_id for vehicle_id, placement in state.placements.items() if placement is not None]
    loaded_weight = sum(vehicles[vehicle_id].weight for vehicle_id in loaded)
    occupied_cells = sum(vehicles[vehicle_id].length * vehicles[vehicle_id].width for vehicle_id in loaded)

    return {
        "objective": evaluate(state, vehicles),
        "loaded_count": len(loaded),
        "unloaded_count": len(vehicles) - len(loaded),
        "loaded_weight": loaded_weight,
        "max_capacity": ship.max_capacity,
        "occupied_cells": occupied_cells,
        "total_cells": ship.width * ship.length,
        "weight_utilization": loaded_weight / ship.max_capacity if ship.max_capacity else None,
        "area_utilization": occupied_cells / (ship.width * ship.length),
    }


def run_algorithm(algorithm_id: str, ship: Ship, vehicles: dict[str, Vehicle], seed: int, objective: str, initial_state: State | None = None, population_size: int = 30, iterations: int = 100) -> dict:
    if algorithm_id not in ALGORITHMS:
        raise ValueError("Select a known algorithm.")

    if objective == "shipping_fee":
        evaluate = shipping_fee_fitness
    elif objective == "eta":
        evaluate = eta_fitness
    else:
        raise ValueError("Objective must be shipping_fee or eta.")

    ga_result = None
    if algorithm_id == "genetic":
        ga_result = genetic_algorithm(ship, vehicles, population_size, iterations, random.Random(seed), evaluate, initial_state)
        initial_state = ga_result["initial_state"]
        final_state = ga_result["best_state"]
        duration_ms = ga_result["runtime_ms"]
    else:
        if initial_state is None:
            initial_state = random_state(ship, vehicles, random.Random(seed))

        started = perf_counter()
        algorithm = ALGORITHMS[algorithm_id]["function"]
        if algorithm_id in ("random_restart", "annealing"):
            final_state = algorithm(initial_state, ship, vehicles, random.Random(seed), evaluate=evaluate)
        else:
            final_state = algorithm(initial_state, ship, vehicles, evaluate=evaluate)
        duration_ms = (perf_counter() - started) * 1000

    if not is_valid(final_state, ship, vehicles):
        raise RuntimeError("Algorithm returned an invalid state.")

    initial_metrics = problem_metrics(initial_state, ship, vehicles, evaluate)
    final_metrics = problem_metrics(final_state, ship, vehicles, evaluate)
    result = {
        "algorithm": algorithm_id,
        "algorithm_name": ALGORITHMS[algorithm_id]["name"],
        "seed": seed,
        "status": "completed",
        "objective": objective,
        "initial_state": serialize_state(initial_state),
        "final_state": serialize_state(final_state),
        "summary": {
            "initial_objective": initial_metrics["objective"],
            "final_objective": final_metrics["objective"],
            "improvement": final_metrics["objective"] - initial_metrics["objective"],
            "duration_ms": duration_ms,
        },
        "initial_metrics": initial_metrics,
        "final_metrics": final_metrics,
    }

    if ga_result is not None:
        result["genetic"] = {
            "population_size": ga_result["population_size"],
            "iterations": ga_result["iterations"],
            "max_fitness_history": ga_result["max_fitness_history"],
            "average_fitness_history": ga_result["average_fitness_history"],
        }

    return result
