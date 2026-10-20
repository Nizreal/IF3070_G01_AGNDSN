import threading
import time

from src.app import app
from src.web_adapter import ALGORITHMS


def run_payload(vehicle_id="A"):
    return {
        "algorithm": "steepest",
        "objective": "fee",
        "seed": 31,
        "ship": {"width": 2, "length": 1, "max_capacity": 5},
        "vehicles": [
            {"id": vehicle_id, "width": 1, "length": 1, "weight": 1, "shipping_fee": 5, "eta": 0},
        ],
    }


def wait_for_run(client, run_id):
    for _ in range(200):
        response = client.get(f"/api/runs/{run_id}")
        body = response.get_json()
        if body["status"] in ("completed", "failed"):
            return body
        time.sleep(0.01)
    raise AssertionError("Run did not finish in time")


def test_background_run_streams_serialized_states_and_final_result():
    client = app.test_client()
    response = client.post("/api/runs", json=run_payload())

    assert response.status_code == 202
    run_id = response.get_json()["run_id"]
    status = wait_for_run(client, run_id)
    events_response = client.get(f"/api/runs/{run_id}/events?after=-1")
    events = events_response.get_json()["events"]

    assert status["status"] == "completed"
    assert status["result"]["trace_available"] is True
    assert events[0]["event_type"] == "initialized"
    assert events[-1]["event_type"] == "stopped"
    assert events[-1]["state"] == status["result"]["final_state"]
    assert isinstance(events[-1]["sequence"], int)

    later_events = client.get(f"/api/runs/{run_id}/events?after={events[0]['sequence']}").get_json()["events"]
    assert all(event["sequence"] > events[0]["sequence"] for event in later_events)


def test_background_worker_keeps_flask_request_responsive(monkeypatch):
    algorithm_started = threading.Event()
    release_algorithm = threading.Event()
    original = ALGORITHMS["steepest"]["function"]

    def wait_then_run(initial_state, ship, vehicles, evaluate, on_progress=None):
        algorithm_started.set()
        release_algorithm.wait(timeout=2)
        return original(initial_state, ship, vehicles, evaluate=evaluate, on_progress=on_progress)

    monkeypatch.setitem(ALGORITHMS["steepest"], "function", wait_then_run)
    client = app.test_client()
    response = client.post("/api/runs", json=run_payload())
    run_id = response.get_json()["run_id"]

    assert response.status_code == 202
    assert algorithm_started.wait(timeout=1)
    assert client.get(f"/api/runs/{run_id}").get_json()["status"] == "running"

    release_algorithm.set()
    assert wait_for_run(client, run_id)["status"] == "completed"


def test_failed_background_run_exposes_a_safe_error(monkeypatch):
    def fail_algorithm(*args, **kwargs):
        raise RuntimeError("test computation failure")

    monkeypatch.setitem(ALGORITHMS["steepest"], "function", fail_algorithm)
    client = app.test_client()
    response = client.post("/api/runs", json=run_payload())
    status = wait_for_run(client, response.get_json()["run_id"])

    assert response.status_code == 202
    assert status["status"] == "failed"
    assert "test computation failure" in status["error"]
