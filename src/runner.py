import random
from time import perf_counter

from .algorithms.brute_force import brute_force
from .algorithms.genetic import genetic_algorithm
from .algorithms.random_restart import random_restart
from .algorithms.sideways import sideways
from .algorithms.simulated_annealing import simulated_annealing
from .algorithms.steepest import steepest_ascent
from .algorithms.stochastic import stochastic
from .models import State, Ship, Vehicle
from .problem import eta_fitness, is_valid, random_state, shipping_fee_fitness


ALGORITHMS = {
    "steepest": "Steepest-Ascent Hill Climbing",
    "stochastic": "Stochastic Hill Climbing",
    "sideways": "Hill Climbing with Sideways Moves",
    "random_restart": "Random-Restart Hill Climbing",
    "annealing": "Simulated Annealing",
    "brute_force": "Brute Force",
    "genetic": "Genetic Algorithm",
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


def run_algorithm(
    algorithm_id: str,
    ship: Ship,
    vehicles: dict[str, Vehicle],
    seed: int,
    objective: str,
    initial_state: State | None = None,
    population_size: int = 30,
    iterations: int = 100,
    max_iterations: int = 100,
    max_sideways_moves: int = 10000,
    max_restarts: int = 100,
) -> dict:
    if algorithm_id not in ALGORITHMS:
        raise ValueError("Select a known algorithm.")

    if objective == "shipping_fee":
        evaluate = shipping_fee_fitness
    elif objective == "eta":
        evaluate = eta_fitness
    else:
        raise ValueError("Objective must be shipping_fee or eta.")

    genetic_result = None
    search_result = None
    if algorithm_id == "genetic":
        genetic_result = genetic_algorithm(ship, vehicles, population_size, iterations, random.Random(seed), evaluate, initial_state)
        initial_state = genetic_result["initial_state"]
        final_state = genetic_result["best_state"]
        duration_ms = genetic_result["runtime_ms"]
        search_result = {
            "iterations": genetic_result["iterations"],
            "iteration_history": list(range(genetic_result["iterations"] + 1)),
            "objective_history": genetic_result["max_fitness_history"],
        }
    else:
        if initial_state is None:
            initial_state = random_state(ship, vehicles, random.Random(seed))

        started = perf_counter()
        rng = random.Random(seed)
        if algorithm_id == "brute_force":
            search_result = brute_force(ship, vehicles, evaluate)
        elif algorithm_id == "random_restart":
            search_result = random_restart(initial_state, ship, vehicles, rng, evaluate, max_restarts)
        elif algorithm_id == "sideways":
            search_result = sideways(initial_state, ship, vehicles, evaluate, max_sideways_moves)
        elif algorithm_id == "annealing":
            search_result = simulated_annealing(
                initial_state,
                ship,
                vehicles,
                rng,
                evaluate=evaluate,
            )
        elif algorithm_id == "stochastic":
            search_result = stochastic(initial_state, ship, vehicles, evaluate=evaluate, rng=rng, max_iterations=max_iterations)
        else:
            search_result = steepest_ascent(initial_state, ship, vehicles, evaluate, rng)

        final_state = search_result["state"]
        duration_ms = (perf_counter() - started) * 1000

    if not is_valid(final_state, ship, vehicles):
        raise RuntimeError("Algorithm returned an invalid state.")

    initial_metrics = problem_metrics(initial_state, ship, vehicles, evaluate)
    final_metrics = problem_metrics(final_state, ship, vehicles, evaluate)
    result = {
        "algorithm": algorithm_id,
        "algorithm_name": ALGORITHMS[algorithm_id],
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
        "search": {
            "iterations": search_result["iterations"],
            "iteration_history": search_result["iteration_history"],
            "objective_history": search_result["objective_history"],
        },
    }

    if genetic_result is not None:
        result["genetic"] = {
            "population_size": genetic_result["population_size"],
            "iterations": genetic_result["iterations"],
            "max_fitness_history": genetic_result["max_fitness_history"],
            "avg_fitness_history": genetic_result["avg_fitness_history"],
        }
    elif algorithm_id == "brute_force":
        result["search"]["states_checked"] = search_result["states_checked"]
    elif algorithm_id == "sideways":
        result["search"]["max_sideways_moves"] = max_sideways_moves
        result["search"]["sideways_moves"] = search_result["sideways_moves"]
    elif algorithm_id == "stochastic":
        result["search"]["max_iterations"] = max_iterations
    elif algorithm_id == "random_restart":
        result["search"]["max_restarts"] = max_restarts
        result["search"]["restart_count"] = search_result["restart_count"]
        result["search"]["iterations_per_restart"] = search_result["iterations_per_restart"]
    elif algorithm_id == "annealing":
        result["annealing"] = {
            "eET_history": search_result["eET_history"],
            "stuck_iterations": search_result["stuck_iterations"],
            "stuck_count": search_result["stuck_count"],
            "stuck_frequency": search_result["stuck_frequency"],
        }

    return result
