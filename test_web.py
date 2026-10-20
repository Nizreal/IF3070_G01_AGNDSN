import json

from src.app import app


def valid_payload():
    return {
        "ship": {"width": 4, "length": 3, "max_capacity": 10},
        "vehicles": [
            {"id": "A", "width": 2, "length": 1, "weight": 4, "shipping_fee": 20, "eta": 2},
            {"id": "B", "width": 1, "length": 1, "weight": 3, "shipping_fee": 10, "eta": 1},
        ],
    }


def test_home_and_api_assets_are_available():
    client = app.test_client()

    response = client.get("/")

    assert response.status_code == 200
    assert b"CARGO // SEARCH LAB" in response.data
    assert client.get("/static/css/style.css").status_code == 200
    assert client.get("/static/js/app.js").status_code == 200
    assert client.get("/api/example").status_code == 200
    assert client.get("/api/algorithms").status_code == 200


def test_validate_rejects_duplicate_vehicle_ids():
    payload = valid_payload()
    payload["vehicles"].append(payload["vehicles"][0].copy())

    response = app.test_client().post("/api/validate", json=payload)

    assert response.status_code == 400
    assert "Duplicate" in response.get_json()["error"]


def test_run_returns_real_final_state_without_fabricated_trace():
    payload = valid_payload() | {"algorithm": "steepest", "seed": 5, "objective": "fee"}

    response = app.test_client().post("/api/run", json=payload)
    result = response.get_json()

    assert response.status_code == 200
    assert result["status"] == "completed"
    assert result["trace_available"] is False
    assert result["frames"] == []
    assert set(result["final_state"]["placements"]) == {"A", "B"}
    assert result["summary"]["final_objective"] >= result["summary"]["initial_objective"]


def test_run_reports_unavailable_algorithm_as_not_implemented():
    payload = valid_payload() | {"algorithm": "genetic", "seed": 5, "objective": "fee"}

    response = app.test_client().post("/api/run", json=payload)

    assert response.status_code == 501


def test_example_json_route_matches_repository_data():
    response = app.test_client().get("/api/example")
    example = json.loads(open("data/example.json", encoding="utf-8").read())

    assert response.get_json() == example


def test_validate_rejects_overlapping_and_out_of_bounds_states():
    client = app.test_client()
    payload = valid_payload() | {"state": {"placements": {
        "A": {"x": 0, "y": 0, "rotated": False},
        "B": {"x": 1, "y": 0, "rotated": False},
    }}}
    overlap_response = client.post("/api/validate", json=payload)
    assert overlap_response.status_code == 400

    payload["state"]["placements"]["B"] = {"x": 4, "y": 0, "rotated": False}
    bounds_response = client.post("/api/validate", json=payload)
    assert bounds_response.status_code == 400


def test_validate_rejects_state_over_ship_capacity():
    payload = valid_payload()
    payload["ship"]["max_capacity"] = 2
    payload["state"] = {"placements": {
        "A": {"x": 0, "y": 0, "rotated": False},
        "B": None,
    }}

    response = app.test_client().post("/api/validate", json=payload)

    assert response.status_code == 400


def test_validate_grid_uses_rotated_footprint_and_top_left_coordinates():
    payload = valid_payload() | {"state": {"placements": {
        "A": {"x": 1, "y": 0, "rotated": True},
        "B": None,
    }}}

    response = app.test_client().post("/api/validate", json=payload)
    grid = response.get_json()["grid"]

    assert response.status_code == 200
    assert grid[0][1] == "A"
    assert grid[1][1] == "A"
    assert grid[0][2] is None


def test_experiments_returns_three_actual_runs():
    payload = valid_payload() | {"algorithm": "steepest", "seed": 10, "objective": "fee"}

    response = app.test_client().post("/api/experiments", json=payload)
    result = response.get_json()

    assert response.status_code == 200
    assert len(result["trials"]) == 3
    assert [trial["seed"] for trial in result["trials"]] == [10, 11, 12]
