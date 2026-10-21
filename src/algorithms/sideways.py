from ..models import State, Ship, Vehicle
from ..problem import fitness
from ..neighbors import iter_neighbors


def sideways(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=fitness) -> State:
    current = initial_state
    sideways_max_iterate = 10000
    iterate_count = 0
    visited_states = set()
    visited_states.add(current.key())

    while True:
        current_score = evaluate(current, vehicles)

        best_neighbor = None
        best_score = current_score 

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            if neighbor_score == current_score and neighbor.key() in visited_states:
                continue

            if (neighbor_score >= best_score):
                best_neighbor = neighbor
                best_score = neighbor_score

        if (best_score > current_score):
            iterate_count = 0
        else :
            iterate_count += 1

        if best_neighbor is None:
            return current

        if iterate_count >= sideways_max_iterate:
            return current

        current = best_neighbor
        visited_states.add(current.key())
