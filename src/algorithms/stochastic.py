import random
from ..models import State, Ship, Vehicle
from ..problem import shipping_fee_fitness
from ..neighbors import iter_neighbors


def stochastic(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=shipping_fee_fitness) -> State:
    currentState = initial_state

    while True:
        currentScore = evaluate(currentState, vehicles)

        improves_neighbors = []

        for neighbor in iter_neighbors(currentState, ship, vehicles):
            neighborScore = evaluate(neighbor, vehicles)

            if neighborScore > currentScore:
                improves_neighbors.append(neighbor)

        if not improves_neighbors:
            return currentState

        currentState = random.choice(improves_neighbors)
