import argparse
import random
from collections.abc import Callable

from .models import Ship, State, Vehicle
from .neighbors import random_neighbor
from .problem import (
    bonus_fitness,
    fitness,
    grid_from_state,
    is_valid,
    load_problem,
    random_state,
)

Evaluator = Callable[[State, dict[str, Vehicle]], float]


def print_ship(state: State, ship: Ship, vehicles: dict[str, Vehicle]) -> None:
    grid = grid_from_state(state, ship, vehicles)
    cell_width = max(1, max((len(vehicle_id) for vehicle_id in vehicles), default=0))

    for row in grid:
        cells = [cell if cell is not None else "." for cell in row]
        print(" ".join(f"{cell:<{cell_width}}" for cell in cells).rstrip())


def print_config(label: str, state: State, ship: Ship, vehicles: dict[str, Vehicle],
                 evaluate: Evaluator = fitness, score_label: str = "Fitness") -> None:
    print(f"{label}:")
    print_ship(state, ship, vehicles)

    loaded_weight = sum(
        vehicles[vehicle_id].weight
        for vehicle_id, placement in state.placements.items()
        if placement is not None
    )
    outside_ids = [
        vehicle_id
        for vehicle_id, placement in state.placements.items()
        if placement is None
    ]

    print(f"{score_label}: {evaluate(state, vehicles):g}")
    print(f"Weight: {loaded_weight:g} / {ship.max_capacity:g}")
    print(f"Outside: {', '.join(outside_ids) if outside_ids else 'None'}")


def run_random(ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, seed: int,
               evaluate: Evaluator = fitness, objective: str = "fee") -> tuple[State, State | None]:
    initial_state = random_state(ship, vehicles, rng)
    if not is_valid(initial_state, ship, vehicles):
        raise RuntimeError("Generated initial state is invalid")

    print("Algorithm: Random Neighbor")
    print(f"Seed: {seed}")
    print(f"Objective: {objective}")
    print()
    if objective == "fee":
        score_label = "Fitness"
        difference_label = "Fitness Difference"
    else:
        score_label = "Density"
        difference_label = "Density Difference"

    print_config("Initial State", initial_state, ship, vehicles, evaluate, score_label)

    neighbor = random_neighbor(initial_state, ship, vehicles, rng)
    if neighbor is None:
        print("\nNo valid distinct neighbor found.")
        return initial_state, None
    if not is_valid(neighbor, ship, vehicles):
        raise RuntimeError("Generated neighbor state is invalid")

    print()
    print_config("Neighbor State", neighbor, ship, vehicles, evaluate, score_label)
    difference = evaluate(neighbor, vehicles) - evaluate(initial_state, vehicles)
    print(f"\n{difference_label}: {difference:+g}")

    return initial_state, neighbor


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Run a terminal experiment or debug the shared model.")
    parser.add_argument("--algorithm", choices=("random", "hc", "sa", "ga"), default="random")
    parser.add_argument("--input", default="data/example.json", help="Path to the problem JSON file")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--objective", choices=("fee", "density"), default="fee")
    args = parser.parse_args(argv)

    if args.algorithm != "random":
        algorithm_names = {"hc": "Hill Climbing", "sa": "Simulated Annealing", "ga": "Genetic Algorithm"}
        print(f"{algorithm_names[args.algorithm]} is not implemented yet.")
        print(f"Objective '{args.objective}' is not applied until this algorithm supports evaluate.")
        return

    ship, vehicles = load_problem(args.input)
    rng = random.Random(args.seed)
    if args.objective == "fee":
        evaluate = fitness
    else:
        evaluate = bonus_fitness
    run_random(ship, vehicles, rng, args.seed, evaluate, args.objective)


if __name__ == "__main__":
    main()
