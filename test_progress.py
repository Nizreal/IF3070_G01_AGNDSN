import random

from src.algorithms import stochastic as stochastic_module
from src.algorithms.sideways import sideways
from src.algorithms.steepest import steepest_ascent
from src.algorithms.stochastic import stochastic
from src.models import Placement, Ship, State, Vehicle


def test_steepest_callback_reports_real_states_and_keeps_snapshots_independent():
    ship = Ship(2, 1, 10)
    vehicles = {"A": Vehicle("A", 1, 1, 1, 5, 0)}
    initial_state = State({"A": None})
    events = []

    def record(event):
        events.append(event)
        if event["event_type"] == "initialized":
            event["state"].placements["A"] = Placement(1, 0, False)

    final_state = steepest_ascent(initial_state, ship, vehicles, on_progress=record)

    assert initial_state.placements == {"A": None}
    assert events[0]["state"].placements == {"A": Placement(1, 0, False)}
    assert events[1]["event_type"] == "state_updated"
    assert events[1]["current_fitness"] == 5
    assert events[-1]["event_type"] == "stopped"
    assert final_state.placements["A"] is not None


def test_steepest_call_without_callback_keeps_its_existing_return_type():
    ship = Ship(1, 1, 10)
    vehicles = {"A": Vehicle("A", 1, 1, 1, 5, 0)}

    result = steepest_ascent(State({"A": None}), ship, vehicles)

    assert isinstance(result, State)
    assert result.placements["A"] == Placement(0, 0, False)


def test_stochastic_callback_does_not_change_random_choice_behavior(monkeypatch):
    ship = Ship(2, 1, 10)
    vehicles = {"A": Vehicle("A", 1, 1, 1, 5, 0)}
    monkeypatch.setattr(stochastic_module.random, "choice", lambda candidates: candidates[0])
    events = []

    result = stochastic(State({"A": None}), ship, vehicles, on_progress=events.append)

    assert events[0]["event_type"] == "initialized"
    assert events[1]["event_type"] == "state_updated"
    assert events[1]["iteration"] == 1
    assert events[-1]["event_type"] == "stopped"
    assert result.placements["A"] == Placement(0, 0, False)


def test_sideways_callback_reports_sideways_limit_and_stop():
    ship = Ship(1, 1, 10)
    vehicles = {"A": Vehicle("A", 1, 1, 1, 0, 0)}
    events = []

    result = sideways(State({"A": Placement(0, 0, False)}), ship, vehicles, on_progress=events.append)

    assert isinstance(result, State)
    assert events[0]["event_type"] == "initialized"
    assert events[0]["metadata"]["max_sideways_moves"] == 1000
    assert events[-1]["event_type"] == "stopped"
    assert events[-1]["metadata"]["termination_reason"]
