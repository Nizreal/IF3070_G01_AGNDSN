from .models import State


def serialize_state(state: State) -> dict:
    placements = {}
    for vehicle_id, placement in state.placements.items():
        if placement is None:
            placements[vehicle_id] = None
        else:
            placements[vehicle_id] = {
                "x": placement.x,
                "y": placement.y,
                "rotated": placement.rotated,
            }
    return {"placements": placements}


def serialize_event(event: dict, sequence: int) -> dict:
    return {
        "sequence": sequence,
        "iteration": event["iteration"],
        "event_type": event["event_type"],
        "current_fitness": event["current_fitness"],
        "best_fitness": event["best_fitness"],
        "state": serialize_state(event["state"]),
        "metadata": dict(event.get("metadata", {})),
    }
