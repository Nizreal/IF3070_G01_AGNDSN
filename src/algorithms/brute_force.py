from ..models import Placement, Ship, State, Vehicle
from ..problem import footprint, is_valid, shipping_fee_fitness


def brute_force(ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness) -> dict:
    vehicle_ids = list(vehicles)
    state = State({vehicle_id: None for vehicle_id in vehicle_ids})
    result = {
        "state": None,
        "score": None,
        "states_checked": 0,
        "objective_history": [],
        "iteration_history": [],
    }

    def search(index: int, loaded_weight: float) -> None:
        if index == len(vehicle_ids):
            result["states_checked"] += 1
            score = evaluate(state, vehicles)
            if result["score"] is None or score > result["score"]:
                result["state"] = State(state.placements.copy())
                result["score"] = score
                result["objective_history"].append(score)
                result["iteration_history"].append(result["states_checked"])
            return

        vehicle_id = vehicle_ids[index]
        vehicle = vehicles[vehicle_id]
        state.placements[vehicle_id] = None
        search(index + 1, loaded_weight)

        if loaded_weight + vehicle.weight > ship.max_capacity:
            return

        for rotated in (False, True):
            if rotated and vehicle.width == vehicle.length:
                continue

            width, length = footprint(vehicle, rotated)
            for y in range(ship.length - length + 1):
                for x in range(ship.width - width + 1):
                    state.placements[vehicle_id] = Placement(x, y, rotated)
                    if is_valid(state, ship, vehicles):
                        search(index + 1, loaded_weight + vehicle.weight)

        state.placements[vehicle_id] = None

    search(0, 0)

    if result["iteration_history"][-1] != result["states_checked"]:
        result["objective_history"].append(result["score"])
        result["iteration_history"].append(result["states_checked"])

    return {
        "state": result["state"],
        "iterations": result["states_checked"],
        "states_checked": result["states_checked"],
        "iteration_history": result["iteration_history"],
        "objective_history": result["objective_history"],
    }
