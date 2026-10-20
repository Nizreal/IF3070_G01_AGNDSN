import threading
import time
from collections import OrderedDict
from uuid import uuid4

from .trace import serialize_event


MAX_RUNS = 24
MAX_ACTIVE_RUNS = 4
MAX_STORED_EVENTS = 8000


class RunManager:
    def __init__(self):
        self._lock = threading.Lock()
        self._runs = OrderedDict()

    def start(self, operation):
        run_id = uuid4().hex
        record = {
            "status": "pending",
            "started_at": None,
            "created_at": time.monotonic(),
            "events": [],
            "event_count": 0,
            "sampled_history": False,
            "result": None,
            "error": None,
        }
        with self._lock:
            active_count = sum(run["status"] in ("pending", "running") for run in self._runs.values())
            if active_count >= MAX_ACTIVE_RUNS:
                raise RuntimeError("The maximum number of active runs has been reached.")
            self._prune_completed_runs()
            self._runs[run_id] = record

        worker = threading.Thread(target=self._execute, args=(run_id, operation), daemon=True)
        worker.start()
        return run_id

    def _prune_completed_runs(self):
        while len(self._runs) >= MAX_RUNS:
            completed_id = next((run_id for run_id, run in self._runs.items() if run["status"] in ("completed", "failed")), None)
            if completed_id is None:
                break
            del self._runs[completed_id]

        if len(self._runs) >= MAX_RUNS:
            raise RuntimeError("The run history is full; wait for an active run to finish.")

    def _execute(self, run_id, operation):
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return
            record["status"] = "running"
            record["started_at"] = time.monotonic()

        try:
            result = operation(lambda event: self.publish(run_id, event))
        except Exception as error:
            with self._lock:
                record = self._runs.get(run_id)
                if record is not None:
                    record["status"] = "failed"
                    record["error"] = f"{type(error).__name__}: {error}"
        else:
            with self._lock:
                record = self._runs.get(run_id)
                if record is not None:
                    if record["events"]:
                        result["summary"]["iterations"] = record["events"][-1]["iteration"]
                    result["trace_available"] = True
                    record["result"] = result
                    record["status"] = "completed"

    def publish(self, run_id, event):
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return

            sequence = record["event_count"]
            record["event_count"] += 1
            record["events"].append(serialize_event(event, sequence))
            if len(record["events"]) > MAX_STORED_EVENTS:
                self._sample_events(record)

    def _sample_events(self, record):
        record["events"] = [
            event for event in record["events"]
            if event["event_type"] in ("initialized", "restarted", "stopped") or event["sequence"] % 2 == 0
        ]
        record["sampled_history"] = True

    def get_status(self, run_id):
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return None
            return self._status_snapshot(run_id, record)

    def get_events(self, run_id, after_sequence=-1):
        with self._lock:
            record = self._runs.get(run_id)
            if record is None:
                return None
            response = self._status_snapshot(run_id, record)
            response["events"] = [event for event in record["events"] if event["sequence"] > after_sequence]
            return response

    def _status_snapshot(self, run_id, record):
        now = time.monotonic()
        start = record["started_at"] or record["created_at"]
        return {
            "run_id": run_id,
            "status": record["status"],
            "elapsed_ms": max(0.0, (now - start) * 1000),
            "event_count": record["event_count"],
            "last_sequence": record["event_count"] - 1,
            "sampled_history": record["sampled_history"],
            "result": record["result"],
            "error": record["error"],
        }


run_manager = RunManager()
