import random
from ..models import State, Ship, Vehicle
from ..problem import fitness
from ..neighbors import iter_neighbors
from ..progress import ProgressCallback, emit_progress


def stochastic(initial_state: State, ship: Ship, vehicles: dict[str, Vehicle], evaluate=fitness, on_progress: ProgressCallback | None = None) -> State:
    currentState = initial_state
    iteration = 0
    started = False
    best_fitness = 0.0

    while True:
        currentScore = evaluate(currentState, vehicles)
        if not started:
            best_fitness = currentScore
            emit_progress(on_progress, iteration, "initialized", currentState, currentScore, best_fitness)
            started = True
        iteration += 1

        improves_neighbors = []
        improves_scores = []
        neighbors_evaluated = 0

        for neighbor in iter_neighbors(currentState, ship, vehicles):
            neighborScore = evaluate(neighbor, vehicles)
            neighbors_evaluated += 1

            if neighborScore > currentScore:
                improves_neighbors.append(neighbor)
                improves_scores.append(neighborScore)

        if not improves_neighbors:
            emit_progress(on_progress, iteration, "stopped", currentState, currentScore, best_fitness, {
                "termination_reason": "no improving neighbor",
                "neighbors_evaluated": neighbors_evaluated,
            })
            return currentState

        currentState = random.choice(improves_neighbors)
        selected_score = improves_scores[improves_neighbors.index(currentState)]
        best_fitness = selected_score
        emit_progress(on_progress, iteration, "state_updated", currentState, selected_score, best_fitness, {
            "improvement": selected_score - currentScore,
            "neighbors_evaluated": neighbors_evaluated,
        })
