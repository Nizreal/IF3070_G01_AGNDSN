const elementIds = [
  "status", "status-light", "ship-width", "ship-length", "ship-capacity", "vehicle-list", "vehicle-count", "grid-count",
  "validation-message", "deck-dimensions", "deck", "x-axis", "y-axis", "unloaded-count", "unloaded-list", "loaded-count",
  "weight-metric", "area-metric", "objective-metric", "vehicle-inspector", "algorithm-select", "algorithm-note", "objective-select",
  "seed-input", "trial-count", "run-button", "validate-button", "result-summary", "initial-objective", "improvement", "compute-time",
  "state-view", "experiment-results", "placement-vehicle", "placement-x", "placement-y", "placement-rotated",
  "place-button", "unload-button", "clear-placement-button", "placement-message", "placement-mode",
];
const elements = Object.fromEntries(elementIds.map((id) => [id, document.getElementById(id)]));

let result = null;
let selectedVehicle = null;
let algorithms = [];
let runInProgress = false;
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
  clearResult();
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
  elements["place-button"].disabled = !vehicles.length || placementPending || Boolean(runInProgress);
  elements["unload-button"].disabled = !vehicles.length || placementPending || Boolean(runInProgress);
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
  if (placementPending || runInProgress) return;
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
  if (placementPending || runInProgress) return;
  editorState = { placements: Object.fromEntries(getProblem().vehicles.map((vehicle) => [vehicle.id, null])) };
  editorObjective = null;
  hasCustomInitialState = false;
  invalidateResult();
  elements["state-view"].value = "editor";
  setPlacementMessage("Automatic start restored. The algorithm will create its initial state from the selected seed.");
  renderDeck();
}

function clearResult() {
  result = null;
  elements["state-view"].value = "editor";
  for (const id of ["initial-objective", "improvement", "compute-time"]) elements[id].textContent = "—";
  elements["experiment-results"].replaceChildren();
}
function invalidateResult() {
  if (!result) return;
  clearResult();
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
  const state = view === "editor" ? editorState : view === "initial" && result ? result.initial_state : view === "final" && result ? result.final_state : null;
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
  const objective = view === "editor"
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
  for (const id of ["ship-width", "ship-length", "ship-capacity", "algorithm-select", "objective-select", "seed-input", "trial-count", "validate-button"]) elements[id].disabled = disabled;
  document.getElementById("add-vehicle").disabled = disabled;
  for (const input of elements["vehicle-list"].querySelectorAll("input, button")) input.disabled = disabled;
  elements["run-button"].disabled = disabled;
  document.getElementById("import-file").disabled = disabled;
  for (const id of ["placement-vehicle", "placement-x", "placement-y", "placement-rotated", "place-button", "unload-button", "clear-placement-button"]) elements[id].disabled = disabled;
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
    trials: Number(elements["trial-count"].value),
  };
  if (hasCustomInitialState) payload.state = editorState;
  return payload;
}

async function runAlgorithm() {
  clearResult();
  runInProgress = true;
  setInputsDisabled(true);
  elements["result-summary"].innerHTML = "<p>Running...</p>";
  setStatus("Running");

  try {
    const data = await requestJson("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(algorithmPayload()),
    });
    result = data.trials.reduce((best, trial) => trial.summary.final_objective > best.summary.final_objective ? trial : best);
    elements["result-summary"].innerHTML = `<p>${data.summary.trial_count} trial${data.summary.trial_count === 1 ? "" : "s"} complete</p><small>Best result saved as ${escapeHtml(result.result_file)}</small>`;
    elements["initial-objective"].textContent = formatNumber(result.summary.initial_objective);
    elements.improvement.textContent = formatNumber(result.summary.improvement);
    elements["compute-time"].textContent = `${result.summary.duration_ms.toFixed(2)} ms`;
    elements["state-view"].value = "final";
    renderDeck();

    const rows = data.trials.map((trial, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${trial.seed}</td>
        <td>${formatNumber(trial.summary.final_objective)}</td>
        <td>${trial.summary.duration_ms.toFixed(2)} ms</td>
        <td>${escapeHtml(trial.result_file)}</td>
      </tr>
    `).join("");
    elements["experiment-results"].innerHTML = `
      <table>
        <thead><tr><th>TRIAL</th><th>SEED</th><th>FINAL OBJECTIVE</th><th>COMPUTE</th><th>FILE</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p>Mean: ${formatNumber(data.summary.mean_final_objective)} · min ${formatNumber(data.summary.min_final_objective)} · max ${formatNumber(data.summary.max_final_objective)}</p>
    `;
    setStatus("Run complete");
  } catch (error) {
    elements["result-summary"].innerHTML = `<p class="error">Run failed</p><small>${escapeHtml(error.message)}</small>`;
    setStatus("Error", true);
  } finally {
    runInProgress = false;
    setInputsDisabled(false);
  }
}

async function initialize() {
  try {
    algorithms = [
      { id: "steepest", name: "Steepest-Ascent Hill Climbing" },
      { id: "stochastic", name: "Stochastic Hill Climbing" },
      { id: "sideways", name: "Hill Climbing with Sideways Moves" },
      { id: "random_restart", name: "Random-Restart Hill Climbing" },
      { id: "annealing", name: "Simulated Annealing" },
    ];
    elements["algorithm-select"].replaceChildren(...algorithms.map((algorithm) => {
      const option = document.createElement("option");
      option.value = algorithm.id;
      option.textContent = algorithm.name;
      return option;
    }));
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
document.getElementById("validate-button").addEventListener("click", validateInput);
elements["run-button"].addEventListener("click", runAlgorithm);
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
  if (elements["state-view"].value !== "editor" || runInProgress || placementPending) return;
  const rect = elements.deck.getBoundingClientRect();
  const step = Number.parseFloat(elements.deck.style.getPropertyValue("--cell-size")) + 2;
  const x = Math.floor((event.clientX - rect.left - 2) / step);
  const y = Math.floor((event.clientY - rect.top - 2) / step);
  const data = getProblem();
  if (x >= 0 && y >= 0 && x < data.ship.width && y < data.ship.length) placeSelectedVehicle(x, y);
});
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
