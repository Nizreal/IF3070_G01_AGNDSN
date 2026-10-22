import random
from collections.abc import Iterator

from .models import Placement, Ship, State, Vehicle
from .problem import footprint, is_valid

# Memindahkan kendaraan ke posisi baru atau mengeluarkannya dari kapal
def move(state: State, vehicle_id: str, placement: Placement | None, ship: Ship, vehicles: dict[str, Vehicle]) -> State | None:
    if vehicle_id not in state.placements:
        return None

    current = state.placements[vehicle_id]
    if current is not None and placement is not None:
        placement = Placement(placement.x, placement.y, current.rotated)

    if current == placement:
        return None

    candidate = State(state.placements.copy())
    candidate.placements[vehicle_id] = placement

    if is_valid(candidate, ship, vehicles):
        return candidate

    return None

# Menukar posisi dua kendaraan
def swap(state: State, first_id: str, second_id: str, ship: Ship, vehicles: dict[str, Vehicle]) -> State | None:
    if first_id not in state.placements or second_id not in state.placements:
        return None

    if state.placements[first_id] == state.placements[second_id]:
        return None

    candidate = State(state.placements.copy())
    candidate.placements[first_id] = state.placements[second_id]
    candidate.placements[second_id] = state.placements[first_id]

    if is_valid(candidate, ship, vehicles):
        return candidate

    return None

# Memutar kendaraan dengan posisi x dan y yang tetap
def rotate(state: State, vehicle_id: str, ship: Ship, vehicles: dict[str, Vehicle]) -> State | None:
    placement = state.placements.get(vehicle_id)
    if placement is None:
        return None

    candidate = State(state.placements.copy())
    candidate.placements[vehicle_id] = Placement(placement.x, placement.y, not placement.rotated)

    if is_valid(candidate, ship, vehicles):
        return candidate

    return None

# Mencari satu neighbor secara acak menggunakan move, swap, atau rotate
def random_neighbor(state: State, ship: Ship, vehicles: dict[str, Vehicle], rng: random.Random, max_attempts: int = 100) -> State | None:
    vehicle_ids = list(vehicles)
    if not vehicle_ids:
        return None

    for _ in range(max_attempts):
        operation = rng.choice(("move", "swap", "rotate"))
        vehicle_id = rng.choice(vehicle_ids)

        if operation == "move":
            placement = None
            if rng.choice((True, False)):
                placement = Placement(rng.randrange(ship.width), rng.randrange(ship.length), rng.choice((True, False)))
            candidate = move(state, vehicle_id, placement, ship, vehicles)
        elif operation == "swap":
            other_id = rng.choice(vehicle_ids)
            candidate = swap(state, vehicle_id, other_id, ship, vehicles)
        else:
            candidate = rotate(state, vehicle_id, ship, vehicles)

        if candidate is not None:
            return candidate

    return None

# Mencoba semua kemungkinan neighbor dari operasi move, swap, dan rotate
def iter_neighbors(state: State, ship: Ship, vehicles: dict[str, Vehicle]) -> Iterator[State]:
    vehicle_ids = list(vehicles)
    seen = set()

    for index, vehicle_id in enumerate(vehicle_ids):
        current = state.placements[vehicle_id]

        if current is not None:
            candidate = move(state, vehicle_id, None, ship, vehicles)
            if candidate is not None:
                seen.add(tuple(candidate.placements.items()))
                yield candidate

        if current is None:
            orientations = (False, True)
        else:
            orientations = (current.rotated,)

        for rotated in orientations:
            width, length = footprint(vehicles[vehicle_id], rotated)
            for y in range(ship.length - length + 1):
                for x in range(ship.width - width + 1):
                    placement = Placement(x, y, rotated)
                    candidate = move(state, vehicle_id, placement, ship, vehicles)
                    if candidate is None:
                        continue

                    key = tuple(candidate.placements.items())
                    if key in seen:
                        continue

                    seen.add(key)
                    yield candidate

        for other_id in vehicle_ids[index + 1:]:
            candidate = swap(state, vehicle_id, other_id, ship, vehicles)
            if candidate is None:
                continue

            key = tuple(candidate.placements.items())
            if key in seen:
                continue

            seen.add(key)
            yield candidate

        if current is not None:
            candidate = rotate(state, vehicle_id, ship, vehicles)
            if candidate is not None:
                key = tuple(candidate.placements.items())
                if key not in seen:
                    seen.add(key)
                    yield candidate
