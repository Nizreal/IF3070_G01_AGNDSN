import json
import random
from datetime import datetime
from pathlib import Path
from time import perf_counter

from flask import Flask, jsonify, render_template, request

from .models import Placement, State
from .problem import is_valid, problem_from_data, random_state
from .runner import run_algorithm, serialize_state


app = Flask(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/example")
def example():
    example_path = Path(__file__).resolve().parent.parent / "data" / "example.json"
    return jsonify(json.loads(example_path.read_text(encoding="utf-8")))


def save_result(result, algorithm_id, trial_count, population_size, iterations):
    output_dir = Path(__file__).resolve().parent.parent / "output"
    output_dir.mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    if algorithm_id == "genetic":
        base_name = f"{timestamp}_{algorithm_id}_pop{population_size}_gen{iterations}_{trial_count}_trials"
    else:
        base_name = f"{timestamp}_{algorithm_id}_{trial_count}_trials"
    filename = f"{base_name}.json"
    suffix = 2
    while (output_dir / filename).exists():
        filename = f"{base_name}_{suffix}.json"
        suffix += 1

    result["result_file"] = filename
    (output_dir / filename).write_text(json.dumps(result, indent=2), encoding="utf-8")


def parse_initial_state(data):
    state_data = data.get("initial_state")
    if state_data is None:
        return None

    placements = {}
    for vehicle_id, item in state_data["placements"].items():
        if item is None:
            placements[vehicle_id] = None
            continue
        if not isinstance(item, dict) or {"x", "y", "rotated"} - item.keys():
            raise ValueError(f"Invalid placement for {vehicle_id}.")
        if isinstance(item["x"], bool) or not isinstance(item["x"], int):
            raise ValueError(f"{vehicle_id} X must be an integer.")
        if isinstance(item["y"], bool) or not isinstance(item["y"], int):
            raise ValueError(f"{vehicle_id} Y must be an integer.")
        if not isinstance(item["rotated"], bool):
            raise ValueError(f"{vehicle_id} rotation must be true or false.")
        placements[vehicle_id] = Placement(item["x"], item["y"], item["rotated"])

    return State(placements)


@app.post("/api/run")
def run():
    data = request.get_json(silent=True)
    try:
        ship, vehicles = problem_from_data(data)
        initial_state = parse_initial_state(data)
        if initial_state is not None and not is_valid(initial_state, ship, vehicles):
            return jsonify({"error": "Initial placements overlap, exceed ship bounds, or exceed capacity."}), 400
        algorithm_id = data.get("algorithm")
        seed = data.get("seed", 42)
        trials = data.get("trials", 1)
        objective = data.get("objective", "shipping_fee")
        population_size = data.get("population_size", 30)
        iterations = data.get("iterations", 100)
        max_iterations = data.get("max_iterations", 100)
        max_sideways_moves = data.get("max_sideways_moves", 10000)
        max_restarts = data.get("max_restarts", 100)

        started = perf_counter()
        results = []
        for trial in range(trials):
            result = run_algorithm(
                algorithm_id,
                ship,
                vehicles,
                seed + trial,
                objective,
                initial_state,
                population_size,
                iterations,
                max_iterations,
                max_sideways_moves,
                max_restarts,
            )
            results.append(result)
        total_duration_ms = (perf_counter() - started) * 1000

        scores = [result["summary"]["final_objective"] for result in results]
        run_result = {
            "trials": results,
            "summary": {
                "trial_count": trials,
                "mean_final_objective": sum(scores) / trials,
                "min_final_objective": min(scores),
                "max_final_objective": max(scores),
                "total_duration_ms": total_duration_ms,
            },
        }
        save_result(run_result, algorithm_id, trials, population_size, iterations)
        return jsonify(run_result)
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Algorithm execution failed")
        return jsonify({"error": "Algorithm execution failed."}), 500


@app.post("/api/random-placements")
def random_placements():
    data = request.get_json(silent=True)
    try:
        ship, vehicles = problem_from_data(data)
        state = random_state(ship, vehicles, random.Random())
        return jsonify(serialize_state(state))
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
