import math
import random
from time import perf_counter

from .algorithms.sideways import sideways
from .algorithms.steepest import steepest_ascent
from .algorithms.stochastic import stochastic
from .models import Placement, Ship, State, Vehicle
from .problem import bonus_fitness, fitness, grid_from_state, is_valid, random_state


ALGORITHMS = {
    "steepest": {"name": "Steepest-Ascent Hill Climbing", "function": steepest_ascent},
    "stochastic": {"name": "Stochastic Hill Climbing", "function": stochastic},
    "sideways": {"name": "Hill Climbing with Sideways Moves", "function": sideways},
}

PENDING_ALGORITHMS = {
    "random_restart": "Random-Restart Hill Climbing",
    "annealing": "Simulated Annealing",
    "genetic": "Genetic Algorithm",
}


def parse_problem(data):
    if not isinstance(data, dict) or not isinstance(data.get("ship"), dict) or not isinstance(data.get("vehicles"), list):
        raise ValueError("Provide a ship object and a vehicles list.")

    ship_data = data["ship"]
    if set(("width", "length", "max_capacity")) - ship_data.keys():
        raise ValueError("Ship requires width, length, and max_capacity.")
    width = _positive_integer(ship_data["width"], "Ship width")
    length = _positive_integer(ship_data["length"], "Ship length")
    capacity = _nonnegative_number(ship_data["max_capacity"], "Maximum capacity")
    ship = Ship(width, length, capacity)

    vehicles = {}
    required = {"id", "width", "length", "weight", "shipping_fee", "eta"}
    for index, item in enumerate(data["vehicles"]):
        if not isinstance(item, dict) or required - item.keys():
            raise ValueError(f"Vehicle {index + 1} requires id, width, length, weight, shipping_fee, and eta.")
        vehicle_id = item["id"]
        if not isinstance(vehicle_id, str) or not vehicle_id.strip():
            raise ValueError(f"Vehicle {index + 1} must have a non-empty ID.")
        if vehicle_id in vehicles:
            raise ValueError(f"Duplicate vehicle ID: {vehicle_id}")

        vehicle = Vehicle(
            vehicle_id,
            _positive_integer(item["width"], f"{vehicle_id} width"),
            _positive_integer(item["length"], f"{vehicle_id} length"),
            _nonnegative_number(item["weight"], f"{vehicle_id} weight"),
            _nonnegative_number(item["shipping_fee"], f"{vehicle_id} shipping fee"),
            _integer(item["eta"], f"{vehicle_id} ETA"),
        )
        vehicles[vehicle_id] = vehicle

    return ship, vehicles


def _positive_integer(value, label):
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        raise ValueError(f"{label} must be a positive integer.")
    return value


def _nonnegative_integer(value, label):
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"{label} must be a nonnegative integer.")
    return value


def _integer(value, label):
    if isinstance(value, bool) or not isinstance(value, int):
        raise ValueError(f"{label} must be an integer.")
    return value


def _nonnegative_number(value, label):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value < 0:
        raise ValueError(f"{label} must be a finite nonnegative number.")
    return value


def parse_state(data, vehicles):
    if not isinstance(data, dict) or not isinstance(data.get("placements"), dict):
        raise ValueError("State must contain a placements object.")
    placements = {}
    for vehicle_id, value in data["placements"].items():
        if value is None:
            placements[vehicle_id] = None
            continue
        if not isinstance(value, dict) or not {"x", "y", "rotated"}.issubset(value):
            raise ValueError(f"Placement for {vehicle_id} must contain x, y, and rotated.")
        x = _nonnegative_integer(value["x"], f"{vehicle_id} x")
        y = _nonnegative_integer(value["y"], f"{vehicle_id} y")
        if not isinstance(value["rotated"], bool):
            raise ValueError(f"{vehicle_id} rotated must be true or false.")
        placements[vehicle_id] = Placement(x, y, value["rotated"])
    return State(placements)


def serialize_state(state):
    placements = {}
    for vehicle_id, placement in state.placements.items():
        if placement is None:
            placements[vehicle_id] = None
        else:
            placements[vehicle_id] = {"x": placement.x, "y": placement.y, "rotated": placement.rotated}
    return {"placements": placements}


def serialize_grid(state, ship, vehicles):
    return grid_from_state(state, ship, vehicles)


def problem_metrics(state, ship, vehicles, evaluate):
    loaded = [vehicle_id for vehicle_id, placement in state.placements.items() if placement is not None]
    loaded_weight = sum(vehicles[vehicle_id].weight for vehicle_id in loaded)
    occupied_cells = sum(
        vehicles[vehicle_id].length * vehicles[vehicle_id].width
        for vehicle_id in loaded
    )
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


def run_algorithm(algorithm_id, ship, vehicles, seed, objective, initial_state=None):
    if algorithm_id in PENDING_ALGORITHMS:
        raise NotImplementedError(f"{PENDING_ALGORITHMS[algorithm_id]} implementation is pending.")
    if algorithm_id not in ALGORITHMS:
        raise ValueError("Select a known algorithm.")

    evaluate = fitness if objective == "fee" else bonus_fitness if objective == "density" else None
    if evaluate is None:
        raise ValueError("Objective must be fee or density.")

    if initial_state is None:
        initial_state = random_state(ship, vehicles, random.Random(seed))
    if not is_valid(initial_state, ship, vehicles):
        raise ValueError("Initial state is invalid for this ship and vehicle list.")

    started = perf_counter()
    final_state = ALGORITHMS[algorithm_id]["function"](initial_state, ship, vehicles, evaluate=evaluate)
    duration_ms = (perf_counter() - started) * 1000
    if not is_valid(final_state, ship, vehicles):
        raise RuntimeError("Algorithm returned a state that failed validation.")

    initial_metrics = problem_metrics(initial_state, ship, vehicles, evaluate)
    final_metrics = problem_metrics(final_state, ship, vehicles, evaluate)
    return {
        "algorithm": algorithm_id,
        "algorithm_name": ALGORITHMS[algorithm_id]["name"],
        "seed": seed,
        "status": "completed",
        "objective": objective,
        "initial_state": serialize_state(initial_state),
        "final_state": serialize_state(final_state),
        "initial_grid": serialize_grid(initial_state, ship, vehicles),
        "final_grid": serialize_grid(final_state, ship, vehicles),
        "trace_available": False,
        "frames": [],
        "metrics": [],
        "summary": {
            "initial_objective": initial_metrics["objective"],
            "final_objective": final_metrics["objective"],
            "improvement": final_metrics["objective"] - initial_metrics["objective"],
            "duration_ms": duration_ms,
            "iterations": None,
            "termination_reason": "algorithm returned its final state; iteration trace is not exposed",
            "seed_controls": "initial state only" if algorithm_id == "stochastic" else "initial state",
        },
        "initial_metrics": initial_metrics,
        "final_metrics": final_metrics,
    }
