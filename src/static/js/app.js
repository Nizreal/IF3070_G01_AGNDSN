const elementIds = [
  "status", "status-light", "ship-width", "ship-length", "ship-capacity", "vehicle-list", "vehicle-count", "grid-count",
  "validation-message", "deck-dimensions", "deck", "x-axis", "y-axis", "unloaded-count", "unloaded-list", "loaded-count",
  "weight-metric", "area-metric", "objective-metric", "vehicle-inspector", "algorithm-select", "algorithm-note", "objective-select",
  "seed-input", "run-button", "experiment-button", "validate-button", "result-summary", "initial-objective", "improvement", "compute-time",
  "iteration-count", "state-view", "trace-status", "trace-explanation", "experiment-results", "live-progress", "run-live-state",
  "run-live-elapsed", "run-progress-bar", "current-iteration", "current-fitness", "best-fitness", "first-button", "previous-button",
  "play-button", "next-button", "last-button", "timeline", "speed-select", "frame-counter", "fitness-chart", "event-log", "trace-count",
  "placement-vehicle", "placement-x", "placement-y", "placement-rotated", "place-button", "unload-button", "clear-placement-button",
  "placement-message", "placement-mode",
];
const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));

let result = null;
let selectedVehicle = null;
let algorithms = [];
let activeRunId = null;
let recordedEvents = [];
let currentFrameIndex = 0;
let playbackTimer = null;
let followingLiveRun = false;
let editorState = { placements: {} };
let editorObjective = null;
let hasCustomInitialState = false;
let placementPending = false;

function setStatus(message, error = false) {
  elements.status.textContent = message.toUpperCase();
  elements["status-light"].style.background = error ? "var(--rust)" : "var(--forest)";
}

function getProblem() {
  return {
    ship: {
      width: Number(elements["ship-width"].value),
      length: Number(elements["ship-length"].value),
      max_capacity: Number(elements["ship-capacity"].value),
    },
    vehicles: [...elements["vehicle-list"].querySelectorAll(".vehicle-card")].map((card) => {
      const value = (name) => card.querySelector(`[data-field="${name}"]`).value;
      return {
        id: value("id").trim(), width: Number(value("width")), length: Number(value("length")),
        weight: Number(value("weight")), shipping_fee: Number(value("shipping_fee")), eta: Number(value("eta")),
      };
    }),
  };
}

function addVehicle(vehicle = { id: "", width: 1, length: 1, weight: 0, shipping_fee: 0, eta: 0 }) {
  const card = document.createElement("article");
  card.className = "vehicle-card";
  card.innerHTML = `<div class="vehicle-card-top"><strong>VEHICLE</strong><button class="remove-vehicle" type="button" aria-label="Remove vehicle">REMOVE ×</button></div><div class="vehicle-card-fields">${[
    ["id", "ID", "text"], ["width", "WIDTH", "number"], ["length", "LENGTH", "number"],
    ["weight", "WEIGHT", "number"], ["shipping_fee", "FEE", "number"], ["eta", "ETA", "number"],
  ].map(([name, label, type]) => `<label>${label}<input data-field="${name}" type="${type}" ${type === "number" ? 'min="0" step="any"' : ""} value=""></label>`).join("")}</div>`;
  for (const [name, value] of Object.entries(vehicle)) card.querySelector(`[data-field="${name}"]`).value = value;
  elements["vehicle-list"].append(card);
  updateCounts();
}

function fillEditor(data) {
  elements["ship-width"].value = data.ship.width;
  elements["ship-length"].value = data.ship.length;
  elements["ship-capacity"].value = data.ship.max_capacity;
  elements["vehicle-list"].replaceChildren();
  data.vehicles.forEach(addVehicle);
  editorState = { placements: Object.fromEntries(data.vehicles.map((vehicle) => [vehicle.id, null])) };
  editorObjective = null;
  hasCustomInitialState = false;
  clearTrace();
  elements["experiment-results"].replaceChildren();
  elements["result-summary"].innerHTML = "<p>Configuration loaded.</p><small>Validate the input, then run an available algorithm.</small>";
  elements["validation-message"].textContent = "";
  updateCounts();
  updatePlacementOptions();
  setPlacementMessage("Algorithm creates the start state automatically until you place a vehicle.");
  renderDeck();
}

function updateCounts() {
  const data = getProblem();
  elements["vehicle-count"].textContent = data.vehicles.length;
  elements["grid-count"].textContent = `${data.ship.width * data.ship.length || 0} deck cells`;
}

function candidateWithPlacement(state, vehicleId, placement) {
  return { placements: { ...state.placements, [vehicleId]: placement } };
}

function setPlacementMessage(message, error = false) {
  elements["placement-message"].textContent = message;
  elements["placement-message"].className = error ? "message placement-message error" : "message placement-message";
  elements["placement-mode"].textContent = hasCustomInitialState ? "CUSTOM START" : "AUTO START";
}

function updatePlacementOptions() {
  const selected = elements["placement-vehicle"].value;
  const vehicles = getProblem().vehicles;
  elements["placement-vehicle"].replaceChildren(...vehicles.map((vehicle) => {
    const option = document.createElement("option");
    option.value = vehicle.id;
    option.textContent = `${vehicle.id || "Unnamed"} · ${vehicle.width} × ${vehicle.length}`;
    return option;
  }));
  if (vehicles.some((vehicle) => vehicle.id === selected)) elements["placement-vehicle"].value = selected;
  elements["place-button"].disabled = !vehicles.length || placementPending || Boolean(activeRunId);
  elements["unload-button"].disabled = !vehicles.length || placementPending || Boolean(activeRunId);
}

function configurationChanged() {
  invalidateResult();
  const vehicles = getProblem().vehicles;
  editorState = { placements: Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, null])) };
  editorObjective = null;
  hasCustomInitialState = false;
  elements["state-view"].value = "editor";
  setPlacementMessage("Configuration changed. Place vehicles again, or use an automatic start.");
  updateCounts();
  updatePlacementOptions();
  renderDeck();
}

async function applyPlacement(placement) {
  if (placementPending || activeRunId) return;
  const vehicleId = elements["placement-vehicle"].value;
  if (!vehicleId) { setPlacementMessage("Select a vehicle first.", true); return; }
  const candidate = candidateWithPlacement(editorState, vehicleId, placement);
  placementPending = true;
  setInputsDisabled(true);
  setPlacementMessage("Checking placement with Python…");
  try {
    const data = await requestJson("/api/validate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...getProblem(), state: candidate }),
    });
    editorState = data.state;
    editorObjective = data.objective;
    hasCustomInitialState = true;
    invalidateResult();
    elements["state-view"].value = "editor";
    setPlacementMessage(placement === null
      ? `${vehicleId} moved outside the deck. This validated state will start the next run.`
      : `${vehicleId} placed at (${placement.x}, ${placement.y})${placement.rotated ? " with rotation" : ""}. This validated state will start the next run.`);
    renderDeck();
  } catch (error) {
    setPlacementMessage(error.message, true);
  } finally {
    placementPending = false;
    setInputsDisabled(false);
    updatePlacementOptions();
  }
}

function placeSelectedVehicle(x = Number(elements["placement-x"].value), y = Number(elements["placement-y"].value)) {
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
    setPlacementMessage("X and Y must be nonnegative whole numbers.", true);
    return;
  }
  elements["placement-x"].value = x;
  elements["placement-y"].value = y;
  applyPlacement({ x, y, rotated: elements["placement-rotated"].checked });
}

function resetPlacement() {
  if (placementPending || activeRunId) return;
  editorState = { placements: Object.fromEntries(getProblem().vehicles.map((vehicle) => [vehicle.id, null])) };
  editorObjective = null;
  hasCustomInitialState = false;
  invalidateResult();
  elements["state-view"].value = "editor";
  setPlacementMessage("Automatic start restored. The algorithm will create its initial state from the selected seed.");
  renderDeck();
}

function clearTrace() {
  stopPlayback();
  result = null;
  activeRunId = null;
  recordedEvents = [];
  currentFrameIndex = 0;
  followingLiveRun = false;
  elements["state-view"].value = "editor";
  elements["trace-status"].textContent = "NO TRACE";
  elements["trace-explanation"].textContent = "Run an implemented algorithm to record actual search states for playback.";
  elements["trace-count"].textContent = "0";
  elements["event-log"].replaceChildren();
  elements["fitness-chart"].replaceChildren();
  elements["timeline"].value = 0;
  elements["timeline"].max = 0;
  elements["frame-counter"].textContent = "—";
  elements["run-live-state"].textContent = "Ready";
  elements["run-live-elapsed"].textContent = "0 ms";
  elements["run-progress-bar"].classList.remove("active");
  for (const id of ["current-iteration", "current-fitness", "best-fitness", "initial-objective", "improvement", "compute-time"]) elements[id].textContent = "—";
  elements["iteration-count"].textContent = "—";
  elements["play-button"].textContent = "Play";
  updatePlaybackControls();
}

function invalidateResult() {
  if (!result && !recordedEvents.length) return;
  clearTrace();
  elements["result-summary"].innerHTML = "<p>Configuration changed.</p><small>Run the algorithm again to compute a result for this input.</small>";
  elements["experiment-results"].replaceChildren();
  renderDeck();
}

function colorFor(id) {
  let hash = 0;
  for (const character of id) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const palette = ["#315b46", "#40566d", "#a45540", "#8c7540", "#64735b", "#635d73"];
  return palette[hash % palette.length];
}

function selectedEvent() { return recordedEvents[currentFrameIndex] || null; }

function renderDeck() {
  const data = getProblem();
  if (!Number.isInteger(data.ship.width) || !Number.isInteger(data.ship.length) || data.ship.width < 1 || data.ship.length < 1) return;
  const viewportWidth = document.querySelector(".deck-scroll").clientWidth || window.innerWidth;
  const availableWidth = viewportWidth - 68;
  const cellSize = Math.max(28, Math.min(88, Math.floor((availableWidth - 4 - (data.ship.width - 1) * 2) / data.ship.width)));
  const deck = elements.deck;
  deck.replaceChildren();
  deck.style.setProperty("--deck-width", data.ship.width);
  deck.style.setProperty("--deck-length", data.ship.length);
  deck.style.setProperty("--cell-size", `${cellSize}px`);
  deck.style.width = `${data.ship.width * cellSize + (data.ship.width - 1) * 2 + 4}px`;
  deck.style.height = `${data.ship.length * cellSize + (data.ship.length - 1) * 2 + 4}px`;
  elements["deck-dimensions"].textContent = `${data.ship.width} × ${data.ship.length}`;
  elements["x-axis"].replaceChildren(...Array.from({ length: data.ship.width }, (_, x) => { const label = document.createElement("span"); label.textContent = x; return label; }));
  elements["y-axis"].replaceChildren(...Array.from({ length: data.ship.length }, (_, y) => { const label = document.createElement("span"); label.textContent = y; return label; }));

  const view = elements["state-view"].value;
  const traceEvent = view === "trace" ? selectedEvent() : null;
  const state = traceEvent?.state || (view === "editor" ? editorState : view === "initial" && result ? result.initial_state : view === "final" && result ? result.final_state : null);
  const placements = state?.placements ?? Object.fromEntries(data.vehicles.map((vehicle) => [vehicle.id, null]));
  const byId = new Map(data.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const loaded = [];
  const unloaded = [];
  for (const [id, placement] of Object.entries(placements)) {
    const vehicle = byId.get(id);
    if (!vehicle) continue;
    if (placement === null) { unloaded.push(vehicle); continue; }
    loaded.push(vehicle);
    const block = document.createElement("button");
    block.type = "button";
    block.className = "vehicle-block";
    block.style.setProperty("--vehicle-color", colorFor(id));
    const width = placement.rotated ? vehicle.length : vehicle.width;
    const length = placement.rotated ? vehicle.width : vehicle.length;
    block.style.gridColumn = `${placement.x + 1} / span ${width}`;
    block.style.gridRow = `${placement.y + 1} / span ${length}`;
    block.setAttribute("aria-label", `${id}, ${width} by ${length}, at ${placement.x}, ${placement.y}`);
    block.innerHTML = `<strong>${escapeHtml(id)}</strong><small>${placement.rotated ? "↻ ROT" : "0°"}</small>`;
    block.addEventListener("click", (event) => {
      event.stopPropagation();
      inspectVehicle(vehicle, placement);
      if (view === "editor") {
        elements["placement-vehicle"].value = id;
        elements["placement-x"].value = placement.x;
        elements["placement-y"].value = placement.y;
        elements["placement-rotated"].checked = placement.rotated;
      }
    });
    deck.append(block);
  }
  elements["unloaded-list"].replaceChildren(...unloaded.map((vehicle) => {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "unloaded-chip"; chip.textContent = vehicle.id;
    chip.addEventListener("click", () => {
      inspectVehicle(vehicle, null);
      if (view === "editor") elements["placement-vehicle"].value = vehicle.id;
    });
    return chip;
  }));
  elements["unloaded-count"].textContent = unloaded.length;
  elements["loaded-count"].textContent = `${loaded.length} / ${data.vehicles.length}`;
  const loadedWeight = loaded.reduce((sum, vehicle) => sum + vehicle.weight, 0);
  const occupied = loaded.reduce((sum, vehicle) => sum + vehicle.width * vehicle.length, 0);
  elements["weight-metric"].textContent = `${loadedWeight} / ${data.ship.max_capacity}`;
  elements["area-metric"].textContent = `${occupied} / ${data.ship.width * data.ship.length}`;
  const objective = traceEvent ? traceEvent.current_fitness : view === "editor"
    ? (elements["objective-select"].value === "fee" ? editorObjective : null)
    : result ? (view === "initial" ? result.summary.initial_objective : result.summary.final_objective) : null;
  elements["objective-metric"].textContent = objective === null ? "—" : formatNumber(objective);
  if (selectedVehicle && byId.has(selectedVehicle)) inspectVehicle(byId.get(selectedVehicle), placements[selectedVehicle]);
}

function inspectVehicle(vehicle, placement) {
  selectedVehicle = vehicle.id;
  const location = placement ? `aboard at (${placement.x}, ${placement.y})${placement.rotated ? " · rotated" : ""}` : "outside / unloaded";
  elements["vehicle-inspector"].textContent = `${vehicle.id} · ${vehicle.width} × ${vehicle.length} · ${vehicle.weight} weight · fee ${vehicle.shipping_fee} · ETA ${vehicle.eta} · ${location}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function formatNumber(value) {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Request failed.");
  return body;
}

function setInputsDisabled(disabled) {
  for (const id of ["ship-width", "ship-length", "ship-capacity", "algorithm-select", "objective-select", "seed-input", "experiment-button", "validate-button"]) elements[id].disabled = disabled;
  document.getElementById("add-vehicle").disabled = disabled;
  for (const input of elements["vehicle-list"].querySelectorAll("input, button")) input.disabled = disabled;
  document.getElementById("load-example").disabled = disabled;
  elements["run-button"].disabled = disabled;
  document.getElementById("import-file").disabled = disabled;
  for (const id of ["placement-vehicle", "placement-x", "placement-y", "placement-rotated", "place-button", "unload-button", "clear-placement-button"]) elements[id].disabled = disabled;
}

function updatePlaybackControls() {
  const available = recordedEvents.length > 0;
  for (const id of ["first-button", "previous-button", "next-button", "last-button", "timeline", "speed-select"]) elements[id].disabled = !available;
  elements["play-button"].disabled = recordedEvents.length < 2;
  elements["timeline"].max = Math.max(0, recordedEvents.length - 1);
  elements["timeline"].value = currentFrameIndex;
  elements["frame-counter"].textContent = available ? `${currentFrameIndex + 1} / ${recordedEvents.length}` : "—";
}

function appendEvents(events) {
  if (!events.length) return;
  const shouldFollow = followingLiveRun || recordedEvents.length === 0;
  for (const event of events) {
    if (recordedEvents.length && event.sequence <= recordedEvents[recordedEvents.length - 1].sequence) continue;
    recordedEvents.push(event);
    const row = document.createElement("li");
    row.dataset.index = String(recordedEvents.length - 1);
    const title = document.createElement("button");
    title.type = "button";
    title.className = "event-row";
    title.textContent = `#${event.iteration} · ${event.event_type.replaceAll("_", " ")}`;
    const details = document.createElement("small");
    const metadata = Object.entries(event.metadata || {}).map(([key, value]) => `${key}: ${value}`).join(" · ");
    details.textContent = `fitness ${formatNumber(event.current_fitness)}${metadata ? ` · ${metadata}` : ""}`;
    title.append(details);
    title.addEventListener("click", () => { followingLiveRun = false; seekTo(Number(row.dataset.index)); });
    row.append(title);
    elements["event-log"].append(row);
  }
  elements["trace-count"].textContent = recordedEvents.length;
  elements["trace-status"].textContent = "LIVE TRACE";
  elements["trace-explanation"].textContent = "Each entry is a state or stop event emitted by the running Python algorithm. Playback follows this recorded history.";
  if (shouldFollow) seekTo(recordedEvents.length - 1);
  renderChart();
  updatePlaybackControls();
}

function seekTo(index) {
  if (!recordedEvents.length) return;
  currentFrameIndex = Math.max(0, Math.min(recordedEvents.length - 1, index));
  elements["state-view"].value = "trace";
  const event = selectedEvent();
  elements["current-iteration"].textContent = event.iteration;
  elements["current-fitness"].textContent = formatNumber(event.current_fitness);
  elements["best-fitness"].textContent = formatNumber(event.best_fitness);
  elements["event-log"].querySelectorAll("li").forEach((row, rowIndex) => row.classList.toggle("selected", rowIndex === currentFrameIndex));
  updatePlaybackControls();
  renderChart();
  renderDeck();
}

function renderChart() {
  const svg = elements["fitness-chart"];
  svg.replaceChildren();
  if (!recordedEvents.length) return;
  const namespace = "http://www.w3.org/2000/svg";
  const make = (tag, attributes = {}) => {
    const node = document.createElementNS(namespace, tag);
    for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
    return node;
  };
  const width = 900, height = 220, left = 54, right = 18, top = 16, bottom = 30;
  const values = recordedEvents.flatMap((event) => [Number(event.current_fitness), Number(event.best_fitness)]).filter(Number.isFinite);
  if (!values.length) return;
  let min = Math.min(...values), max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const x = (index) => left + (recordedEvents.length < 2 ? 0 : index / (recordedEvents.length - 1) * (width - left - right));
  const y = (value) => top + (max - value) / (max - min) * (height - top - bottom);
  for (let line = 0; line < 4; line += 1) {
    const lineY = top + line * (height - top - bottom) / 3;
    svg.append(make("line", { x1: left, y1: lineY, x2: width - right, y2: lineY, class: "chart-grid" }));
    const label = make("text", { x: left - 8, y: lineY + 4, "text-anchor": "end", class: "chart-label" });
    label.textContent = formatNumber(max - line * (max - min) / 3);
    svg.append(label);
  }
  svg.append(make("line", { x1: left, y1: top, x2: left, y2: height - bottom, class: "chart-axis" }));
  svg.append(make("line", { x1: left, y1: height - bottom, x2: width - right, y2: height - bottom, class: "chart-axis" }));
  const series = (key, className) => make("polyline", {
    points: recordedEvents.map((event, index) => `${x(index)},${y(Number(event[key]))}`).join(" "), class: className,
  });
  svg.append(series("current_fitness", "chart-current"), series("best_fitness", "chart-best"));
  const selected = recordedEvents[currentFrameIndex];
  svg.append(make("circle", { cx: x(currentFrameIndex), cy: y(Number(selected.best_fitness)), r: 5, class: "chart-marker" }));
}

function stopPlayback() {
  if (playbackTimer) window.clearInterval(playbackTimer);
  playbackTimer = null;
  elements["play-button"].textContent = "Play";
}

function togglePlayback() {
  if (playbackTimer) { stopPlayback(); return; }
  if (currentFrameIndex >= recordedEvents.length - 1) seekTo(0);
  elements["play-button"].textContent = "Pause";
  const speed = [0.5, 1, 2, 4][elements["speed-select"].selectedIndex] || 1;
  playbackTimer = window.setInterval(() => {
    if (currentFrameIndex >= recordedEvents.length - 1) { stopPlayback(); return; }
    seekTo(currentFrameIndex + 1);
  }, 700 / speed);
}

function applyRunStatus(snapshot) {
  elements["run-live-state"].textContent = snapshot.status;
  elements["run-live-elapsed"].textContent = `${formatNumber(snapshot.elapsed_ms)} ms`;
  elements["run-progress-bar"].classList.toggle("active", snapshot.status === "pending" || snapshot.status === "running");
  if (snapshot.status === "running" || snapshot.status === "pending") setStatus(snapshot.status === "pending" ? "Queued" : "Computing");
}

async function pollRun(runId) {
  while (activeRunId === runId) {
    const snapshot = await requestJson(`/api/runs/${runId}/events?after=${recordedEvents.length ? recordedEvents[recordedEvents.length - 1].sequence : -1}`);
    applyRunStatus(snapshot);
    appendEvents(snapshot.events || []);
    if (snapshot.status === "completed") {
      result = snapshot.result;
      setInputsDisabled(false);
      followingLiveRun = false;
      elements["trace-status"].textContent = snapshot.sampled_history ? "SAMPLED TRACE" : "RECORDED TRACE";
      elements["trace-explanation"].textContent = snapshot.sampled_history
        ? "Large history was sampled by the backend; the initial, final, and key events were retained."
        : "Recorded states come directly from algorithm execution. Use the timeline or event list to inspect each state.";
      elements["result-summary"].innerHTML = `<p>${escapeHtml(result.algorithm_name)} complete</p><small>Actual Python result · seed ${result.seed} · ${escapeHtml(snapshot.status)}</small>`;
      elements["initial-objective"].textContent = formatNumber(result.summary.initial_objective);
      elements.improvement.textContent = formatNumber(result.summary.improvement);
      elements["compute-time"].textContent = `${result.summary.duration_ms.toFixed(2)} ms`;
      elements["iteration-count"].textContent = result.summary.iterations;
      if (recordedEvents.length) seekTo(recordedEvents.length - 1);
      else { elements["state-view"].value = "final"; renderDeck(); }
      setStatus("Run complete");
      activeRunId = null;
      return;
    }
    if (snapshot.status === "failed") {
      setInputsDisabled(false);
      elements["result-summary"].innerHTML = `<p class="error">Run failed</p><small>${escapeHtml(snapshot.error || "Unknown worker error")}</small>`;
      elements["trace-explanation"].textContent = "Execution stopped with an error. Any states recorded before failure remain available.";
      setStatus("Run failed", true);
      activeRunId = null;
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }
}

async function loadExample() {
  const data = await requestJson("/api/example");
  fillEditor(data);
  setStatus("Ready");
}

async function validateInput() {
  elements["validation-message"].textContent = "Validating with Python model…";
  elements["validation-message"].className = "message";
  try {
    const payload = { ...getProblem() };
    if (hasCustomInitialState) payload.state = editorState;
    const data = await requestJson("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    elements["validation-message"].textContent = hasCustomInitialState
      ? `Valid placement · shipping fee ${formatNumber(data.objective)} at the selected start state.`
      : `Valid configuration · shipping fee ${formatNumber(data.objective)} at a generated start state.`;
    elements["validation-message"].className = "message success";
    setStatus("Input valid");
  } catch (error) {
    elements["validation-message"].textContent = error.message;
    elements["validation-message"].className = "message error";
    setStatus("Validation error", true);
  }
}

function algorithmPayload() {
  const payload = {
    ...getProblem(),
    algorithm: elements["algorithm-select"].value,
    objective: elements["objective-select"].value,
    seed: Number(elements["seed-input"].value),
  };
  if (hasCustomInitialState) payload.state = editorState;
  return payload;
}

async function runAlgorithm() {
  if (activeRunId) return;
  clearTrace();
  setInputsDisabled(true);
  elements["run-live-state"].textContent = "Submitting";
  elements["result-summary"].innerHTML = "<p>Starting algorithm…</p><small>Live updates show actual Python execution progress.</small>";
  setStatus("Submitting run");
  try {
    const payload = algorithmPayload();
    const response = await requestJson("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    activeRunId = response.run_id;
    followingLiveRun = true;
    elements["run-live-state"].textContent = response.status;
    await pollRun(activeRunId);
  } catch (error) {
    activeRunId = null;
    setInputsDisabled(false);
    elements["result-summary"].innerHTML = `<p class="error">Run failed</p><small>${escapeHtml(error.message)}</small>`;
    elements["run-live-state"].textContent = "Failed";
    setStatus("Error", true);
  }
}

async function runExperiments() {
  elements["experiment-button"].disabled = true;
  setStatus("Running three trials");
  try {
    const payload = { ...getProblem(), algorithm: elements["algorithm-select"].value, objective: elements["objective-select"].value, seed: Number(elements["seed-input"].value) };
    const data = await requestJson("/api/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const rows = data.trials.map((trial, index) => `<tr><td>${index + 1}</td><td>${trial.seed}</td><td>${formatNumber(trial.summary.final_objective)}</td><td>${trial.summary.duration_ms.toFixed(2)} ms</td></tr>`).join("");
    elements["experiment-results"].innerHTML = `<table><thead><tr><th>TRIAL</th><th>SEED</th><th>FINAL OBJECTIVE</th><th>COMPUTE</th></tr></thead><tbody>${rows}</tbody></table><p>Observed mean: ${formatNumber(data.summary.mean_final_objective)} · min ${formatNumber(data.summary.min_final_objective)} · max ${formatNumber(data.summary.max_final_objective)}. Iteration curves are unavailable for this endpoint.</p>`;
    setStatus("Trials complete");
  } catch (error) {
    elements["experiment-results"].textContent = error.message;
    elements["experiment-results"].className = "experiment-results error";
    setStatus("Experiment unavailable", true);
  } finally {
    elements["experiment-button"].disabled = Boolean(activeRunId);
  }
}

async function initialize() {
  try {
    algorithms = await requestJson("/api/algorithms");
    elements["algorithm-select"].replaceChildren(...algorithms.map((algorithm) => {
      const option = document.createElement("option");
      option.value = algorithm.id;
      option.textContent = algorithm.available ? algorithm.name : `${algorithm.name} · Implementation Pending`;
      option.disabled = !algorithm.available;
      return option;
    }));
    elements["algorithm-select"].addEventListener("change", () => {
      elements["algorithm-note"].textContent = "Progress is captured from the actual algorithm loop; no estimated steps are shown.";
    });
    await loadExample();
  } catch (error) {
    setStatus("Connection error", true);
    elements["validation-message"].textContent = error.message;
  }
}

document.getElementById("add-vehicle").addEventListener("click", () => { addVehicle(); configurationChanged(); });
elements["vehicle-list"].addEventListener("click", (event) => {
  if (event.target.matches(".remove-vehicle")) { event.target.closest(".vehicle-card").remove(); configurationChanged(); }
});
elements["vehicle-list"].addEventListener("input", configurationChanged);
for (const id of ["ship-width", "ship-length", "ship-capacity"]) {
  elements[id].addEventListener("input", configurationChanged);
}
document.getElementById("load-example").addEventListener("click", () => loadExample().catch((error) => setStatus(error.message, true)));
document.getElementById("validate-button").addEventListener("click", validateInput);
elements["run-button"].addEventListener("click", runAlgorithm);
elements["experiment-button"].addEventListener("click", runExperiments);
elements["state-view"].addEventListener("change", renderDeck);
elements["objective-select"].addEventListener("change", renderDeck);
elements["placement-vehicle"].addEventListener("change", () => {
  const placement = editorState.placements[elements["placement-vehicle"].value];
  elements["placement-x"].value = placement?.x ?? 0;
  elements["placement-y"].value = placement?.y ?? 0;
  elements["placement-rotated"].checked = placement?.rotated ?? false;
});
elements["place-button"].addEventListener("click", () => placeSelectedVehicle());
elements["unload-button"].addEventListener("click", () => applyPlacement(null));
elements["clear-placement-button"].addEventListener("click", resetPlacement);
elements.deck.addEventListener("click", (event) => {
  if (elements["state-view"].value !== "editor" || activeRunId || placementPending) return;
  const rect = elements.deck.getBoundingClientRect();
  const step = Number.parseFloat(elements.deck.style.getPropertyValue("--cell-size")) + 2;
  const x = Math.floor((event.clientX - rect.left - 2) / step);
  const y = Math.floor((event.clientY - rect.top - 2) / step);
  const data = getProblem();
  if (x >= 0 && y >= 0 && x < data.ship.width && y < data.ship.length) placeSelectedVehicle(x, y);
});
elements["timeline"].addEventListener("input", (event) => { followingLiveRun = false; seekTo(Number(event.target.value)); });
elements["first-button"].addEventListener("click", () => { followingLiveRun = false; seekTo(0); });
elements["previous-button"].addEventListener("click", () => { followingLiveRun = false; seekTo(currentFrameIndex - 1); });
elements["play-button"].addEventListener("click", togglePlayback);
elements["next-button"].addEventListener("click", () => { followingLiveRun = false; seekTo(currentFrameIndex + 1); });
elements["last-button"].addEventListener("click", () => { followingLiveRun = false; seekTo(recordedEvents.length - 1); });
window.addEventListener("resize", renderDeck);
document.getElementById("export-json").addEventListener("click", () => {
  const file = new Blob([`${JSON.stringify(getProblem(), null, 2)}\n`], { type: "application/json" });
  const link = document.createElement("a"); link.href = URL.createObjectURL(file); link.download = "cargo-problem.json"; link.click(); URL.revokeObjectURL(link.href);
});
document.getElementById("import-file").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try { fillEditor(JSON.parse(await file.text())); elements["validation-message"].textContent = "Imported JSON. Validate before running."; }
  catch { elements["validation-message"].textContent = "Could not read a valid problem JSON file."; elements["validation-message"].className = "message error"; }
  event.target.value = "";
});

initialize();
