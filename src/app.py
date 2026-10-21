import json
import random
from pathlib import Path
from uuid import uuid4

from flask import Flask, jsonify, render_template, request

from .problem import fitness, is_valid, random_state
from .web.web_adapter import (
    parse_problem,
    parse_state,
    run_algorithm,
    serialize_state,
)


app = Flask(__name__)


@app.get("/")
def index():
    return render_template("index.html")


@app.get("/api/example")
def example():
    example_path = Path(__file__).resolve().parent.parent / "data" / "example.json"
    return jsonify(json.loads(example_path.read_text(encoding="utf-8")))


def save_result(result):
    output_dir = Path(__file__).resolve().parent.parent / "output"
    output_dir.mkdir(exist_ok=True)
    filename = f"run_{uuid4().hex}.json"
    result["result_file"] = filename
    (output_dir / filename).write_text(json.dumps(result, indent=2), encoding="utf-8")


@app.post("/api/validate")
def validate():
    data = request.get_json(silent=True)
    try:
        ship, vehicles = parse_problem(data)
        state_data = data.get("state")
        if state_data is None:
            state = random_state(ship, vehicles, random.Random(0))
        else:
            state = parse_state(state_data, vehicles)
        if not is_valid(state, ship, vehicles):
            return jsonify({"valid": False, "error": "State overlaps, exceeds deck bounds, exceeds capacity, or omits vehicle IDs."}), 400
        return jsonify({
            "valid": True,
            "state": serialize_state(state),
            "objective": fitness(state, vehicles),
        })
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"valid": False, "error": str(error)}), 400


@app.post("/api/run")
def run():
    data = request.get_json(silent=True)
    try:
        ship, vehicles = parse_problem(data)
        algorithm_id = data.get("algorithm")
        seed = data.get("seed", 42)
        if isinstance(seed, bool) or not isinstance(seed, int):
            return jsonify({"error": "Seed must be an integer."}), 400
        trials = data.get("trials", 1)
        if isinstance(trials, bool) or not isinstance(trials, int) or trials < 1:
            return jsonify({"error": "Trials must be a positive integer."}), 400
        objective = data.get("objective", "fee")
        initial_state = parse_state(data["state"], vehicles) if data.get("state") is not None else None
        if initial_state is not None and not is_valid(initial_state, ship, vehicles):
            return jsonify({"error": "Initial state is invalid."}), 400

        results = []
        for trial in range(trials):
            result = run_algorithm(algorithm_id, ship, vehicles, seed + trial, objective, initial_state)
            save_result(result)
            results.append(result)

        scores = [result["summary"]["final_objective"] for result in results]
        return jsonify({
            "trials": results,
            "summary": {
                "trial_count": trials,
                "mean_final_objective": sum(scores) / trials,
                "min_final_objective": min(scores),
                "max_final_objective": max(scores),
            },
        })
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Algorithm execution failed")
        return jsonify({"error": "Algorithm execution failed."}), 500
