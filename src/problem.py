import json
import random
from pathlib import Path

from .models import Placement, Ship, State, Vehicle


def footprint(vehicle: Vehicle, rotated: bool) -> tuple[int, int]:
    if rotated:
        return vehicle.length, vehicle.width
    return vehicle.width, vehicle.length


def load_problem(path: str | Path) -> tuple[Ship, dict[str, Vehicle]] | None:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    ship_data = data["ship"]
    ship = Ship(width=ship_data["width"], length=ship_data["length"], max_capacity=ship_data["max_capacity"])

    if ship.width <= 0 or ship.length <= 0 or ship.max_capacity < 0:
        print("Invalid ship dimensions or capacity.")
        return None

    vehicles: dict[str, Vehicle] = {}
    for item in data["vehicles"]:
        vehicle = Vehicle(**item)
        if vehicle.id in vehicles:
            print(f"Duplicate vehicle ID: {vehicle.id}.")
            return None
        if vehicle.width < 0 or vehicle.length < 0 or vehicle.weight < 0 or vehicle.shipping_fee < 0:
            print(f"{vehicle.id}: invalid dimensions, weight, or fee.")
            return None
        vehicles[vehicle.id] = vehicle

    return ship, vehicles


def is_valid(state: State, ship: Ship, vehicles: dict[str, Vehicle]) -> bool:
    if state.placements.keys() != vehicles.keys():
        return False

    occupied: set[tuple[int, int]] = set()
    total_weight = 0.0

    for vehicle_id, placement in state.placements.items():
        if placement is None:
            continue

        vehicle = vehicles[vehicle_id]
        width, length = footprint(vehicle, placement.rotated)
        if placement.x < 0 or placement.y < 0 or placement.x + width > ship.width or placement.y + length > ship.length:
            return False

        total_weight += vehicle.weight
        if total_weight > ship.max_capacity:
            return False

        for y in range(placement.y, placement.y + length):
            for x in range(placement.x, placement.x + width):
                if (x, y) in occupied:
                    return False
                occupied.add((x, y))

    return True


def fitness(state: State, vehicles: dict[str, Vehicle]) -> float:
    total_fee = 0
    for vehicle_id, placement in state.placements.items():
        if placement is not None:
            total_fee += vehicles[vehicle_id].shipping_fee

    return total_fee


def bonus_fitness(state: State, vehicles: dict[str, Vehicle]) -> float:
    total_density = 0.0
    for vehicle_id, placement in state.placements.items():
        if placement is not None:
            vehicle = vehicles[vehicle_id]
            area = vehicle.width * vehicle.length
            total_density += vehicle.shipping_fee / area

    return total_density


def grid_from_state(state: State, ship: Ship, vehicles: dict[str, Vehicle]) -> list[list[str | None]]:
    if not is_valid(state, ship, vehicles):
        raise ValueError("State invalid")

    grid: list[list[str | None]] = []
    for y in range(ship.length):
        row: list[str | None] = []
        for x in range(ship.width):
            row.append(None)
        grid.append(row)

    for vehicle_id, placement in state.placements.items():
        if placement is None:
            continue

        vehicle = vehicles[vehicle_id]
        width, length = footprint(vehicle, placement.rotated)
        for y in range(placement.y, placement.y + length):
            for x in range(placement.x, placement.x + width):
                grid[y][x] = vehicle_id

    return grid


def random_state(ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random) -> State:
    state = State({vehicle_id: None for vehicle_id in vehicles})
    vehicle_ids = list(vehicles)
    rng.shuffle(vehicle_ids)

    for vehicle_id in vehicle_ids:
        vehicle = vehicles[vehicle_id]
        possible_placements: list[Placement] = []
        for rotated in (False, True):
            width, length = footprint(vehicle, rotated)
            for y in range(ship.length - length + 1):
                for x in range(ship.width - width + 1):
                    possible_placements.append(Placement(x, y, rotated))

        rng.shuffle(possible_placements)
        for placement in possible_placements:
            state.placements[vehicle_id] = placement
            if is_valid(state, ship, vehicles):
                break
            state.placements[vehicle_id] = None

    return state
