const elements = Object.fromEntries([
  "status", "status-light", "ship-width", "ship-length", "ship-capacity", "vehicle-list", "vehicle-count", "grid-count",
  "validation-message", "deck-dimensions", "deck", "x-axis", "y-axis", "unloaded-count", "unloaded-list", "loaded-count",
  "weight-metric", "area-metric", "objective-metric", "vehicle-inspector", "algorithm-select", "algorithm-note", "objective-select",
  "seed-input", "run-button", "experiment-button", "result-summary", "initial-objective", "improvement", "compute-time",
  "iteration-count", "state-view", "trace-status", "trace-explanation", "experiment-results",
].map((id) => [id, document.getElementById(id)]));

let problem = { ship: { width: 4, length: 4, max_capacity: 0 }, vehicles: [] };
let result = null;
let selectedVehicle = null;
let algorithms = [];

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
  problem = data;
  elements["ship-width"].value = data.ship.width;
  elements["ship-length"].value = data.ship.length;
  elements["ship-capacity"].value = data.ship.max_capacity;
  elements["vehicle-list"].replaceChildren();
  data.vehicles.forEach(addVehicle);
  result = null;
  elements["state-view"].value = "editor";
  elements["experiment-results"].replaceChildren();
  elements["result-summary"].innerHTML = "<p>Configuration loaded.</p><small>Validate the input, then run an available algorithm.</small>";
  elements["validation-message"].textContent = "";
  updateCounts();
  renderDeck();
}

function updateCounts() {
  const data = getProblem();
  elements["vehicle-count"].textContent = data.vehicles.length;
  elements["grid-count"].textContent = `${data.ship.width * data.ship.length || 0} deck cells`;
}

function invalidateResult() {
  if (!result) return;
  result = null;
  elements["state-view"].value = "editor";
  elements["result-summary"].innerHTML = "<p>Configuration changed.</p><small>Run the algorithm again to compute a result for this input.</small>";
  elements["initial-objective"].textContent = "—";
  elements.improvement.textContent = "—";
  elements["compute-time"].textContent = "—";
  elements["iteration-count"].textContent = "Not exposed";
  elements["trace-status"].textContent = "NO TRACE";
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
  const cellSize = Math.max(18, Math.min(42, Math.floor((window.innerWidth - 100) / data.ship.width)));
  const deck = elements.deck;
  deck.replaceChildren();
  deck.style.setProperty("--deck-width", data.ship.width);
  deck.style.setProperty("--deck-length", data.ship.length);
  deck.style.setProperty("--cell-size", `${cellSize}px`);
  deck.style.width = `${data.ship.width * cellSize + (data.ship.width - 1) * 2 + 4}px`;
  deck.style.height = `${data.ship.length * cellSize + (data.ship.length - 1) * 2 + 4}px`;
  elements["deck-dimensions"].textContent = `${data.ship.width} × ${data.ship.length}`;
  elements["x-axis"].replaceChildren(...Array.from({ length: data.ship.width }, (_, x) => {
    const label = document.createElement("span"); label.textContent = x; return label;
  }));
  elements["y-axis"].replaceChildren(...Array.from({ length: data.ship.length }, (_, y) => {
    const label = document.createElement("span"); label.textContent = y; return label;
  }));

  const view = elements["state-view"].value;
  const state = view === "initial" && result ? result.initial_state : view === "final" && result ? result.final_state : null;
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
    block.addEventListener("click", () => inspectVehicle(vehicle, placement));
    deck.append(block);
  }
  elements["unloaded-list"].replaceChildren(...unloaded.map((vehicle) => {
    const chip = document.createElement("button");
    chip.type = "button"; chip.className = "unloaded-chip"; chip.textContent = vehicle.id;
    chip.addEventListener("click", () => inspectVehicle(vehicle, null));
    return chip;
  }));
  elements["unloaded-count"].textContent = unloaded.length;
  elements["loaded-count"].textContent = `${loaded.length} / ${data.vehicles.length}`;
  const loadedWeight = loaded.reduce((sum, vehicle) => sum + vehicle.weight, 0);
  const occupied = loaded.reduce((sum, vehicle) => sum + vehicle.width * vehicle.length, 0);
  elements["weight-metric"].textContent = `${loadedWeight} / ${data.ship.max_capacity}`;
  elements["area-metric"].textContent = `${occupied} / ${data.ship.width * data.ship.length}`;
  const objective = result && view !== "editor"
    ? (view === "initial" ? result.summary.initial_objective : result.summary.final_objective)
    : null;
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

function renderResult(data) {
  result = data;
  elements["state-view"].value = "final";
  elements["result-summary"].innerHTML = `<p>${escapeHtml(data.algorithm_name)} complete</p><small>Final solution returned by the Python algorithm · seed ${data.seed}</small>`;
  elements["initial-objective"].textContent = formatNumber(data.summary.initial_objective);
  elements.improvement.textContent = formatNumber(data.summary.improvement);
  elements["compute-time"].textContent = `${data.summary.duration_ms.toFixed(2)} ms`;
  elements["iteration-count"].textContent = "Not exposed";
  elements["trace-status"].textContent = "TRACE UNAVAILABLE";
  elements["trace-explanation"].textContent = data.summary.termination_reason;
  elements["validation-message"].textContent = "";
  elements["validation-message"].className = "message";
  setStatus("Replay unavailable · final state ready");
  renderDeck();
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
    const data = await requestJson("/api/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(getProblem()) });
    elements["validation-message"].textContent = `Valid configuration · objective ${formatNumber(data.objective)} at the generated valid starting state.`;
    elements["validation-message"].className = "message success";
    setStatus("Input valid");
  } catch (error) {
    elements["validation-message"].textContent = error.message;
    elements["validation-message"].className = "message error";
    setStatus("Validation error", true);
  }
}

async function runAlgorithm() {
  elements["run-button"].disabled = true;
  setStatus("Computing");
  try {
    const payload = { ...getProblem(), algorithm: elements["algorithm-select"].value, objective: elements["objective-select"].value, seed: Number(elements["seed-input"].value) };
    renderResult(await requestJson("/api/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }));
  } catch (error) {
    elements["result-summary"].innerHTML = `<p class="error">Run failed</p><small>${escapeHtml(error.message)}</small>`;
    setStatus("Error", true);
  } finally {
    elements["run-button"].disabled = false;
  }
}

async function runExperiments() {
  elements["experiment-button"].disabled = true;
  setStatus("Running three trials");
  try {
    const payload = { ...getProblem(), algorithm: elements["algorithm-select"].value, objective: elements["objective-select"].value, seed: Number(elements["seed-input"].value) };
    const data = await requestJson("/api/experiments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    const rows = data.trials.map((trial, index) => `<tr><td>${index + 1}</td><td>${trial.seed}</td><td>${formatNumber(trial.summary.final_objective)}</td><td>${trial.summary.duration_ms.toFixed(2)} ms</td></tr>`).join("");
    elements["experiment-results"].innerHTML = `<table><thead><tr><th>TRIAL</th><th>SEED</th><th>FINAL OBJECTIVE</th><th>COMPUTE</th></tr></thead><tbody>${rows}</tbody></table><p>Observed mean: ${formatNumber(data.summary.mean_final_objective)} · min ${formatNumber(data.summary.min_final_objective)} · max ${formatNumber(data.summary.max_final_objective)}. Iteration curves are unavailable.</p>`;
    setStatus("Trials complete");
  } catch (error) {
    elements["experiment-results"].textContent = error.message;
    elements["experiment-results"].className = "experiment-results error";
    setStatus("Experiment unavailable", true);
  } finally {
    elements["experiment-button"].disabled = false;
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
      elements["algorithm-note"].textContent = "Only final-state output is exposed by this implementation; no search trace is available.";
    });
    await loadExample();
  } catch (error) {
    setStatus("Connection error", true);
    elements["validation-message"].textContent = error.message;
  }
}

document.getElementById("add-vehicle").addEventListener("click", () => { invalidateResult(); addVehicle(); renderDeck(); });
elements["vehicle-list"].addEventListener("click", (event) => {
  if (event.target.matches(".remove-vehicle")) { event.target.closest(".vehicle-card").remove(); invalidateResult(); updateCounts(); renderDeck(); }
});
elements["vehicle-list"].addEventListener("input", () => { invalidateResult(); updateCounts(); renderDeck(); });
for (const id of ["ship-width", "ship-length", "ship-capacity"]) {
  document.getElementById(id).addEventListener("input", () => { invalidateResult(); updateCounts(); renderDeck(); });
}
document.getElementById("load-example").addEventListener("click", () => loadExample().catch((error) => setStatus(error.message, true)));
document.getElementById("validate-button").addEventListener("click", validateInput);
elements["run-button"].addEventListener("click", runAlgorithm);
elements["experiment-button"].addEventListener("click", runExperiments);
elements["state-view"].addEventListener("change", renderDeck);
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
