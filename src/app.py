import json
import random
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from .problem import fitness, is_valid, random_state
from .web.run_manager import run_manager
from .web.web_adapter import (
    ALGORITHMS,
    PENDING_ALGORITHMS,
    parse_problem,
    parse_state,
    run_algorithm,
    serialize_grid,
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


@app.get("/api/algorithms")
def algorithms():
    available = [
        {"id": algorithm_id, "name": details["name"], "available": True}
        for algorithm_id, details in ALGORITHMS.items()
    ]
    pending = [
        {"id": algorithm_id, "name": name, "available": False, "status": "Implementation Pending"}
        for algorithm_id, name in PENDING_ALGORITHMS.items()
    ]
    return jsonify(available + pending)


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
            "grid": serialize_grid(state, ship, vehicles),
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
            raise ValueError("Seed must be an integer.")
        objective = data.get("objective", "fee")
        initial_state = parse_state(data["state"], vehicles) if data.get("state") is not None else None
        return jsonify(run_algorithm(algorithm_id, ship, vehicles, seed, objective, initial_state))
    except NotImplementedError as error:
        return jsonify({"error": str(error)}), 501
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
    except Exception:
        app.logger.exception("Algorithm execution failed")
        return jsonify({"error": "Algorithm execution failed."}), 500


@app.post("/api/runs")
def start_run():
    data = request.get_json(silent=True)
    try:
        ship, vehicles = parse_problem(data)
        algorithm_id = data.get("algorithm")
        if algorithm_id in PENDING_ALGORITHMS:
            raise NotImplementedError(f"{PENDING_ALGORITHMS[algorithm_id]} implementation is pending.")
        if algorithm_id not in ALGORITHMS:
            raise ValueError("Select a known algorithm.")

        seed = data.get("seed", 42)
        if isinstance(seed, bool) or not isinstance(seed, int):
            raise ValueError("Seed must be an integer.")
        objective = data.get("objective", "fee")
        if objective not in ("fee", "density"):
            raise ValueError("Objective must be fee or density.")
        initial_state = parse_state(data["state"], vehicles) if data.get("state") is not None else None
        if initial_state is not None and not is_valid(initial_state, ship, vehicles):
            raise ValueError("Initial state is invalid for this ship and vehicle list.")

        operation = lambda on_progress: run_algorithm(
            algorithm_id,
            ship,
            vehicles,
            seed,
            objective,
            initial_state,
            on_progress,
        )
        run_id = run_manager.start(operation)
        return jsonify({"run_id": run_id, "status": "pending"}), 202
    except NotImplementedError as error:
        return jsonify({"error": str(error)}), 501
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
    except RuntimeError as error:
        return jsonify({"error": str(error)}), 429


@app.get("/api/runs/<run_id>")
def run_status(run_id):
    status = run_manager.get_status(run_id)
    if status is None:
        return jsonify({"error": "Run not found."}), 404
    return jsonify(status)


@app.get("/api/runs/<run_id>/events")
def run_events(run_id):
    after_value = request.args.get("after", "-1")
    try:
        after_sequence = int(after_value)
        if after_sequence < -1:
            raise ValueError
    except ValueError:
        return jsonify({"error": "after must be an integer greater than or equal to -1."}), 400

    response = run_manager.get_events(run_id, after_sequence)
    if response is None:
        return jsonify({"error": "Run not found."}), 404
    return jsonify(response)


@app.post("/api/experiments")
def experiments():
    data = request.get_json(silent=True)
    try:
        ship, vehicles = parse_problem(data)
        algorithm_id = data.get("algorithm")
        if algorithm_id in PENDING_ALGORITHMS:
            raise NotImplementedError(f"{PENDING_ALGORITHMS[algorithm_id]} implementation is pending.")
        results = []
        for trial in range(3):
            seed = data.get("seed", 42) + trial
            results.append(run_algorithm(algorithm_id, ship, vehicles, seed, data.get("objective", "fee")))
        scores = [result["summary"]["final_objective"] for result in results]
        return jsonify({"algorithm": algorithm_id, "trials": results, "summary": {
            "trial_count": len(results),
            "mean_final_objective": sum(scores) / len(scores),
            "min_final_objective": min(scores),
            "max_final_objective": max(scores),
        }})
    except NotImplementedError as error:
        return jsonify({"error": str(error)}), 501
    except (ValueError, TypeError, KeyError) as error:
        return jsonify({"error": str(error)}), 400
