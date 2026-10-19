from ..models import State, Ship, Vehicle
from ..problem import fitness
from ..neighbors import iter_neighbors

def steepest_ascent(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=fitness) -> State:
    current = initial_state

    while True:
        current_score = evaluate(current, vehicles)

        best_neighbor = None
        best_score = current_score 

        for neighbor in iter_neighbors(current, ship, vehicles):
            neighbor_score = evaluate(neighbor, vehicles)

            if (neighbor_score > best_score):
                best_neighbor = neighbor
                best_score = neighbor_score

        if (best_neighbor is None):
            return current

        current = best_neighbor
            