import json
import math
import random
from pathlib import Path

from .models import Placement, Ship, State, Vehicle

# Mengambil ukuran kendaraan
def footprint(vehicle: Vehicle, rotated: bool) -> tuple[int, int]:
    if rotated:
        return vehicle.length, vehicle.width
    return vehicle.width, vehicle.length

# Membaca dan memvalidasi data input kapal dan kendaraan
def problem_from_data(data) -> tuple[Ship, dict[str, Vehicle]]:
    if not isinstance(data, dict) or not isinstance(data.get("ship"), dict) or not isinstance(data.get("vehicles"), list):
        raise ValueError("Invalid problem data.")

    ship_data = data["ship"]
    if {"width", "length", "max_capacity"} - ship_data.keys():
        raise ValueError("Missing ship fields.")
    width = ship_data["width"]
    length = ship_data["length"]
    capacity = ship_data["max_capacity"]
    if width < 0 or length < 0:
        raise ValueError("Ship dimensions cannot be negative.")
    if isinstance(capacity, bool) or not isinstance(capacity, (int, float)) or not math.isfinite(capacity) or capacity < 0:
        raise ValueError("Invalid ship capacity.")
    ship = Ship(width, length, capacity)

    vehicles: dict[str, Vehicle] = {}
    required = {"id", "width", "length", "weight", "shipping_fee", "eta"}
    for index, item in enumerate(data["vehicles"]):
        if not isinstance(item, dict) or required - item.keys():
            raise ValueError(f"Invalid vehicle data at row {index + 1}.")
        vehicle_id = item["id"]
        if not isinstance(vehicle_id, str) or not vehicle_id.strip():
            raise ValueError(f"Vehicle {index + 1} needs an ID.")
        if vehicle_id in vehicles:
            raise ValueError(f"Duplicate vehicle ID: {vehicle_id}.")

        width = item["width"]
        length = item["length"]
        weight = item["weight"]
        shipping_fee = item["shipping_fee"]
        eta = item["eta"]
        if width < 0 or length < 0:
            raise ValueError(f"{vehicle_id} dimensions cannot be negative.")
        if isinstance(weight, bool) or not isinstance(weight, (int, float)) or not math.isfinite(weight) or weight < 0:
            raise ValueError(f"Invalid weight for {vehicle_id}.")
        if isinstance(shipping_fee, bool) or not isinstance(shipping_fee, (int, float)) or not math.isfinite(shipping_fee) or shipping_fee < 0:
            raise ValueError(f"Invalid shipping fee for {vehicle_id}.")
        if isinstance(eta, bool) or not isinstance(eta, int):
            raise ValueError(f"Invalid ETA for {vehicle_id}.")

        vehicle = Vehicle(vehicle_id, width, length, weight, shipping_fee, eta)
        vehicles[vehicle.id] = vehicle

    return ship, vehicles

# Membaca data kapal dan kendaraan dari file JSON
def load_problem(path: str | Path) -> tuple[Ship, dict[str, Vehicle]]:
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return problem_from_data(data)

# Mengecek validasi penempatan kendaraan memenuhi batas ukuran deck, kapasitas, dan tidak saling bertabrakan
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

# Menghitung total shipping fee dari kendaraan yang dimuat ke kapal
def shipping_fee_fitness(state: State, vehicles: dict[str, Vehicle]) -> float:
    total_fee = 0
    for vehicle_id, placement in state.placements.items():
        if placement is not None:
            total_fee += vehicles[vehicle_id].shipping_fee

    return total_fee

# Menghitung skor prioritas kendaraan berdasarkan ETA, semakin kecil ETA semakin besar skornya
def eta_fitness(state: State, vehicles: dict[str, Vehicle]) -> float:
    total_score = 0.0

    for vehicle_id, placement in state.placements.items():
        if placement is not None:
            vehicle = vehicles[vehicle_id]
            total_score += 1 / (vehicle.eta + 1)

    return total_score

# Mengubah state menjadi grid 2D untuk menampilkan posisi kendaraan pada deck
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

# Membuat state awal dengan mencoba menempatkan kendaraan pada posisi dan orientasi secara acak
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
