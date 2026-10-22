const elements = {
  status: document.getElementById("status"),
  toggleConfig: document.getElementById("toggle-config"),
  toggleResult: document.getElementById("toggle-result"),
  form: document.getElementById("run-form"),
  resultPanel: document.getElementById("result-panel"),
  runSettings: document.getElementById("run-settings"),
  problemFile: document.getElementById("problem-file"),
  shipWidth: document.getElementById("ship-width"),
  shipLength: document.getElementById("ship-length"),
  shipCapacity: document.getElementById("ship-capacity"),
  vehicleList: document.getElementById("vehicle-list"),
  algorithm: document.getElementById("algorithm-select"),
  gaSettings: document.getElementById("ga-settings"),
  populationSize: document.getElementById("population-size"),
  iterations: document.getElementById("iterations"),
  stochasticSettings: document.getElementById("stochastic-settings"),
  maxIterations: document.getElementById("max-iterations"),
  sidewaysSettings: document.getElementById("sideways-settings"),
  maxSidewaysMoves: document.getElementById("max-sideways-moves"),
  restartSettings: document.getElementById("restart-settings"),
  maxRestarts: document.getElementById("max-restarts"),
  objective: document.getElementById("objective-select"),
  seed: document.getElementById("seed-input"),
  trials: document.getElementById("trial-count"),
  runButton: document.getElementById("run-button"),
  runError: document.getElementById("run-error"),
  deckSize: document.getElementById("deck-size"),
  deckMessage: document.getElementById("deck-message"),
  deck: document.getElementById("deck"),
  outsideList: document.getElementById("outside-list"),
  trialPicker: document.getElementById("trial-picker"),
  trialSelect: document.getElementById("trial-select"),
  resultSummary: document.getElementById("result-summary"),
  restartResult: document.getElementById("restart-result"),
  restartIterations: document.getElementById("restart-iterations"),
  resultJson: document.getElementById("result-json"),
  annealingChartSection: document.getElementById("annealing-chart-section"),
  annealingChart: document.getElementById("annealing-chart"),
  fitnessChartSection: document.getElementById("fitness-chart-section"),
  fitnessChart: document.getElementById("fitness-chart"),
  fitnessChartLegend: document.getElementById("fitness-chart-legend"),
};

const randomSettings = {
  minShipSize: 4,
  maxShipSize: 10,
  minVehicles: 3,
  maxVehicles: 8,
  minVehicleSize: 1,
  maxVehicleSize: 2,
  minWeight: 2,
  maxWeight: 4,
  minFee: 20,
  maxFee: 60,
  minEta: 1,
  maxEta: 3,
};

let runData = null;
let selectedTrial = null;
let runTimer = null;
let runStartedAt = 0;

function getProblem() {
  const vehicles = [];

  for (const row of elements.vehicleList.querySelectorAll(".vehicle-row")) {
    const vehicle = {};
    for (const input of row.querySelectorAll("[data-field]")) {
      const value = input.value.trim();
      vehicle[input.dataset.field] = input.type === "number" ? Number(value) : value;
    }
    vehicles.push(vehicle);
  }

  return {
    ship: {
      width: Number(elements.shipWidth.value),
      length: Number(elements.shipLength.value),
      max_capacity: Number(elements.shipCapacity.value),
    },
    vehicles,
  };
}

function getInitialState() {
  const placements = {};

  for (const row of elements.vehicleList.querySelectorAll(".vehicle-row")) {
    const vehicleId = row.querySelector('[data-field="id"]').value.trim();
    if (!vehicleId) continue;

    if (row.querySelector(".outside-vehicle").checked) {
      placements[vehicleId] = null;
    } else {
      placements[vehicleId] = {
        x: Number(row.querySelector(".placement-x").value),
        y: Number(row.querySelector(".placement-y").value),
        rotated: row.querySelector(".placement-rotated").checked,
      };
    }
  }

  return { placements };
}

function randomInteger(minimum, maximum) {
  return Math.floor(Math.random() * (maximum - minimum + 1)) + minimum;
}

function addVehicle(vehicle = {}) {
  const fields = [
    ["id", "ID", "text"],
    ["width", "Width", "number"],
    ["length", "Length", "number"],
    ["weight", "Weight", "number"],
    ["shipping_fee", "Fee", "number"],
    ["eta", "ETA", "number"],
  ];
  const row = document.createElement("div");
  row.className = "vehicle-row";

  for (const [name, labelText, type] of fields) {
    const label = document.createElement("label");
    label.textContent = labelText;

    const input = document.createElement("input");
    input.type = type;
    input.dataset.field = name;
    input.required = true;

    if (type === "number") {
      input.min = name === "width" || name === "length" ? "1" : "0";
      input.step = name === "width" || name === "length" || name === "eta" ? "1" : "any";
    }

    if (vehicle[name] !== undefined) input.value = vehicle[name];
    label.append(input);
    row.append(label);
  }

  const placementFields = document.createElement("div");
  placementFields.className = "placement-fields";

  for (const coordinate of ["x", "y"]) {
    const label = document.createElement("label");
    label.textContent = coordinate.toUpperCase();

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.required = true;
    input.className = `placement-${coordinate}`;
    label.append(input);
    placementFields.append(label);
  }

  const placementOptions = document.createElement("div");
  placementOptions.className = "placement-options";

  const rotatedLabel = document.createElement("label");
  const rotatedInput = document.createElement("input");
  rotatedInput.type = "checkbox";
  rotatedInput.className = "placement-rotated";
  rotatedLabel.append(rotatedInput, " Rotate");

  const outsideLabel = document.createElement("label");
  const outsideInput = document.createElement("input");
  outsideInput.type = "checkbox";
  outsideInput.className = "outside-vehicle";
  outsideInput.checked = true;
  outsideLabel.append(outsideInput, " Outside");

  placementOptions.append(rotatedLabel, outsideLabel);
  placementFields.append(placementOptions);
  row.append(placementFields);

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.textContent = "Remove";
  removeButton.className = "remove-vehicle";
  row.append(removeButton);
  elements.vehicleList.append(row);
  updatePlacementInputs(row);
}

function updatePlacementInputs(row) {
  const outside = row.querySelector(".outside-vehicle").checked;
  row.querySelector(".placement-x").disabled = outside;
  row.querySelector(".placement-y").disabled = outside;
  row.querySelector(".placement-rotated").disabled = outside;
}

function clearResult() {
  runData = null;
  selectedTrial = null;
  elements.trialPicker.hidden = true;
  elements.trialSelect.replaceChildren();
  elements.runError.textContent = "";
  elements.resultSummary.textContent = "No result yet.";
  elements.resultJson.textContent = "...";
  elements.annealingChartSection.hidden = true;
  elements.restartResult.hidden = true;
  elements.restartIterations.replaceChildren();
  elements.fitnessChartSection.hidden = true;
  renderDeck(getInitialState());
}

function updateAlgorithmFields() {
  const algorithm = elements.algorithm.value;
  const isGenetic = algorithm === "genetic";
  const isStochastic = algorithm === "stochastic";
  const isSideways = algorithm === "sideways";
  const isRandomRestart = algorithm === "random_restart";
  elements.gaSettings.hidden = !isGenetic;
  elements.populationSize.disabled = !isGenetic;
  elements.iterations.disabled = !isGenetic;
  elements.stochasticSettings.hidden = !isStochastic;
  elements.maxIterations.disabled = !isStochastic;
  elements.sidewaysSettings.hidden = !isSideways;
  elements.maxSidewaysMoves.disabled = !isSideways;
  elements.restartSettings.hidden = !isRandomRestart;
  elements.maxRestarts.disabled = !isRandomRestart;
}

function fillForm(problem) {
  if (!problem || !problem.ship || !Array.isArray(problem.vehicles)) {
    throw new Error("JSON must contain ship and vehicles.");
  }

  elements.shipWidth.value = problem.ship.width;
  elements.shipLength.value = problem.ship.length;
  elements.shipCapacity.value = problem.ship.max_capacity;
  elements.vehicleList.replaceChildren();

  for (const vehicle of problem.vehicles) {
    addVehicle(vehicle);
    const row = elements.vehicleList.lastElementChild;
    const placement = problem.initial_state?.placements?.[vehicle.id];
    if (placement !== undefined) setPlacement(row, placement);
  }

  clearResult();
}

function renderDeck(state = null) {
  const problem = getProblem();
  const width = problem.ship.width;
  const length = problem.ship.length;

  elements.deck.replaceChildren();
  elements.outsideList.replaceChildren();
  elements.deckSize.textContent = "";
  elements.deckMessage.hidden = false;
  elements.deck.hidden = true;

  if (!Number.isInteger(width) || !Number.isInteger(length) || width < 1 || length < 1) {
    elements.deckMessage.textContent = "Enter a valid deck size.";
    return;
  }

  const availableWidth = elements.deck.parentElement.clientWidth;
  const availableHeight = window.innerHeight * 0.65;
  const widthCellSize = Math.floor((availableWidth - width * 2 - 2) / width);
  const heightCellSize = Math.floor((availableHeight - length * 2 - 2) / length);
  const cellSize = Math.max(12, Math.min(56, widthCellSize, heightCellSize));

  elements.deck.style.gridTemplateColumns = `repeat(${width}, ${cellSize}px)`;
  elements.deck.style.gridTemplateRows = `repeat(${length}, ${cellSize}px)`;
  elements.deckSize.textContent = `${width} × ${length}`;

  for (let y = 0; y < length; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const cell = document.createElement("div");
      cell.className = "deck-cell";
      elements.deck.append(cell);
    }
  }

  if (state === null) {
    elements.deckMessage.hidden = true;
    elements.deck.hidden = false;
    return;
  }

  const vehicles = new Map(problem.vehicles.map((vehicle) => [vehicle.id, vehicle]));
  const colors = ["#cfe2d2", "#dce0f0", "#f0dfcf", "#eee7bd", "#d7e5e8", "#ead8e3"];
  let colorIndex = 0;

  for (const [vehicleId, placement] of Object.entries(state.placements)) {
    const vehicle = vehicles.get(vehicleId);
    if (placement === null) {
      const listItem = document.createElement("li");
      listItem.textContent = vehicleId;
      elements.outsideList.append(listItem);
      continue;
    }
    if (vehicle === undefined) continue;

    const vehicleBlock = document.createElement("div");
    vehicleBlock.className = "vehicle-block";
    vehicleBlock.textContent = vehicleId;
    vehicleBlock.style.gridColumn = `${placement.x + 1} / span ${placement.rotated ? vehicle.length : vehicle.width}`;
    vehicleBlock.style.gridRow = `${placement.y + 1} / span ${placement.rotated ? vehicle.width : vehicle.length}`;
    vehicleBlock.style.backgroundColor = colors[colorIndex % colors.length];
    colorIndex += 1;
    elements.deck.append(vehicleBlock);
  }

  elements.deckMessage.hidden = true;
  elements.deck.hidden = false;
}

function randomizeGrid() {
  elements.shipWidth.value = randomInteger(randomSettings.minShipSize, randomSettings.maxShipSize);
  elements.shipLength.value = randomInteger(randomSettings.minShipSize, randomSettings.maxShipSize);

  for (const row of elements.vehicleList.querySelectorAll(".vehicle-row")) {
    setPlacement(row, null);
  }

  clearResult();
}

function randomizeVehicles() {
  const vehicleCount = randomInteger(randomSettings.minVehicles, randomSettings.maxVehicles);
  elements.vehicleList.replaceChildren();

  for (let index = 1; index <= vehicleCount; index += 1) {
    addVehicle({
      id: `V${index}`,
      width: randomInteger(randomSettings.minVehicleSize, randomSettings.maxVehicleSize),
      length: randomInteger(randomSettings.minVehicleSize, randomSettings.maxVehicleSize),
      weight: randomInteger(randomSettings.minWeight, randomSettings.maxWeight),
      shipping_fee: randomInteger(randomSettings.minFee, randomSettings.maxFee),
      eta: randomInteger(randomSettings.minEta, randomSettings.maxEta),
    });
  }

  clearResult();
}

function setPlacement(row, placement) {
  const outside = placement === null;
  row.querySelector(".outside-vehicle").checked = outside;

  if (!outside) {
    row.querySelector(".placement-x").value = placement.x;
    row.querySelector(".placement-y").value = placement.y;
    row.querySelector(".placement-rotated").checked = placement.rotated;
  }

  updatePlacementInputs(row);
}

async function randomizePlacements() {
  elements.runError.textContent = "";

  try {
    const result = await requestJson("/api/random-placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getProblem()),
    });

    for (const row of elements.vehicleList.querySelectorAll(".vehicle-row")) {
      const vehicleId = row.querySelector('[data-field="id"]').value.trim();
      setPlacement(row, result.placements[vehicleId]);
    }

    clearResult();
  } catch (error) {
    elements.runError.textContent = error.message;
  }
}

async function randomizeInitialState() {
  randomizeGrid();
  randomizeVehicles();
  await randomizePlacements();
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function loadExample() {
  try {
    const problem = await requestJson("/api/example");
    fillForm(problem);
    elements.status.textContent = "Ready";
  } catch (error) {
    elements.status.textContent = "Could not load example: " + error.message;
  }
}

async function loadProblemFile(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    fillForm(JSON.parse(await file.text()));
    elements.status.textContent = "Loaded " + file.name;
  } catch (error) {
    elements.runError.textContent = "Could not load JSON: " + error.message;
  }

  elements.problemFile.value = "";
}

function saveProblemFile() {
  const problem = {
    ...getProblem(),
    initial_state: getInitialState(),
  };
  const file = new Blob([JSON.stringify(problem, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "problem.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

async function runAlgorithm(event) {
  event.preventDefault();
  runData = null;
  selectedTrial = null;
  elements.trialPicker.hidden = true;
  elements.trialSelect.replaceChildren();
  elements.runError.textContent = "";
  elements.runButton.disabled = true;
  elements.annealingChartSection.hidden = true;
  elements.fitnessChartSection.hidden = true;
  elements.restartResult.hidden = true;
  elements.restartIterations.replaceChildren();
  runStartedAt = performance.now();
  elements.status.textContent = "Running... 0.0 s";
  runTimer = setInterval(() => {
    const elapsed = (performance.now() - runStartedAt) / 1000;
    elements.status.textContent = `Running... ${elapsed.toFixed(1)} s`;
  }, 100);
  elements.resultSummary.textContent = "Running...";
  elements.resultJson.textContent = "Running...";

  const payload = {
    ...getProblem(),
    initial_state: getInitialState(),
    algorithm: elements.algorithm.value,
    objective: elements.objective.value,
    seed: Number(elements.seed.value),
    trials: Number(elements.trials.value),
  };

  if (elements.algorithm.value === "genetic") {
    payload.population_size = Number(elements.populationSize.value);
    payload.iterations = Number(elements.iterations.value);
  }
  if (elements.algorithm.value === "stochastic") {
    payload.max_iterations = Number(elements.maxIterations.value);
  }
  if (elements.algorithm.value === "sideways") {
    payload.max_sideways_moves = Number(elements.maxSidewaysMoves.value);
  }
  if (elements.algorithm.value === "random_restart") {
    payload.max_restarts = Number(elements.maxRestarts.value);
  }

  try {
    const data = await requestJson("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let bestTrialIndex = 0;
    runData = data;
    let bestTrial = data.trials[0];

    for (let index = 0; index < data.trials.length; index += 1) {
      const trial = data.trials[index];
      if (trial.summary.final_objective > bestTrial.summary.final_objective) {
        bestTrial = trial;
        bestTrialIndex = index;
      }
    }

    data.trials.forEach((trial, index) => {
      const option = document.createElement("option");
      option.value = index;
      option.textContent = `Trial ${index + 1}: objective ${trial.summary.final_objective}`;
      elements.trialSelect.append(option);
    });
    elements.trialSelect.value = bestTrialIndex;
    elements.trialPicker.hidden = data.trials.length < 2;
    showTrial(bestTrialIndex);
    elements.status.textContent = "Complete";
  } catch (error) {
    runData = null;
    selectedTrial = null;
    elements.resultSummary.textContent = "No result.";
    elements.resultJson.textContent = "No result.";
    elements.fitnessChartSection.hidden = true;
    elements.runError.textContent = error.message;
    elements.status.textContent = "Run failed";
    renderDeck(getInitialState());
  } finally {
    clearInterval(runTimer);
    elements.runButton.disabled = false;
  }
}

document.getElementById("add-vehicle").addEventListener("click", () => {
  addVehicle();
  clearResult();
});

elements.vehicleList.addEventListener("click", (event) => {
  if (event.target.matches(".remove-vehicle")) {
    event.target.closest(".vehicle-row").remove();
    clearResult();
  }
});

elements.vehicleList.addEventListener("change", (event) => {
  if (event.target.matches(".outside-vehicle")) {
    updatePlacementInputs(event.target.closest(".vehicle-row"));
    clearResult();
  }
});

elements.form.addEventListener("input", clearResult);
elements.runSettings.addEventListener("input", clearResult);
elements.algorithm.addEventListener("change", () => {
  updateAlgorithmFields();
  clearResult();
});
elements.form.addEventListener("submit", runAlgorithm);
elements.trialSelect.addEventListener("change", () => showTrial(Number(elements.trialSelect.value)));
elements.problemFile.addEventListener("change", loadProblemFile);
document.getElementById("save-json").addEventListener("click", saveProblemFile);
document.getElementById("randomize-all").addEventListener("click", randomizeInitialState);
document.getElementById("randomize-grid").addEventListener("click", randomizeGrid);
document.getElementById("randomize-vehicles").addEventListener("click", randomizeVehicles);
document.getElementById("randomize-placements").addEventListener("click", randomizePlacements);
elements.toggleConfig.addEventListener("click", () => {
  const hidden = !elements.form.hidden;
  elements.form.hidden = hidden;
  elements.toggleConfig.textContent = hidden ? "Show config" : "Hide config";
  requestAnimationFrame(renderDeckAfterLayout);
});
elements.toggleResult.addEventListener("click", () => {
  const hidden = !elements.resultPanel.hidden;
  elements.resultPanel.hidden = hidden;
  elements.toggleResult.textContent = hidden ? "Show result" : "Hide result";
  requestAnimationFrame(renderDeckAfterLayout);
});
window.addEventListener("resize", renderDeckAfterLayout);
updateAlgorithmFields();
loadExample();

function renderDeckAfterLayout() {
  if (selectedTrial) {
    drawFitnessChart(selectedTrial);
    if (selectedTrial.annealing) drawAnnealingChart(selectedTrial.annealing);
  }

  if (selectedTrial === null) {
    renderDeck(getInitialState());
    return;
  }

  renderDeck(selectedTrial.final_state);
}

function showTrial(index) {
  selectedTrial = runData.trials[index];
  const isRestart = selectedTrial.algorithm === "random_restart";
  elements.restartResult.hidden = !isRestart;
  elements.restartIterations.replaceChildren();
  if (isRestart) {
    selectedTrial.search.iterations_per_restart.forEach((count) => {
      const item = document.createElement("li");
      item.textContent = `${count} iterations`;
      elements.restartIterations.append(item);
    });
  }
  const totalVehicles = Object.keys(selectedTrial.final_state.placements).length;
  const objectiveName = selectedTrial.objective === "eta" ? "ETA" : "Shipping fee";
  elements.resultSummary.textContent = [
    `Algorithm: ${selectedTrial.algorithm_name}`,
    `Objective: ${objectiveName}`,
    `Trial: ${index + 1} of ${runData.summary.trial_count}`,
    `Final objective: ${selectedTrial.summary.final_objective}`,
    `Mean objective: ${runData.summary.mean_final_objective}`,
    `Vehicles loaded: ${selectedTrial.final_metrics.loaded_count} of ${totalVehicles}`,
    `Trial runtime: ${selectedTrial.summary.duration_ms.toFixed(2)} ms`,
    `Total runtime: ${runData.summary.total_duration_ms.toFixed(2)} ms`,
    ...(selectedTrial.algorithm === "brute_force"
      ? [`Complete states checked: ${selectedTrial.search.states_checked}`]
      : [`Iterations: ${selectedTrial.search.iterations}`]),
    ...(selectedTrial.genetic ? [
      `Population: ${selectedTrial.genetic.population_size}`,
    ] : []),
    ...(selectedTrial.algorithm === "sideways" ? [
      `Consecutive sideways moves at stop: ${selectedTrial.search.sideways_moves}`,
      `Maximum sideways moves: ${selectedTrial.search.max_sideways_moves}`,
    ] : []),
    ...(selectedTrial.algorithm === "random_restart" ? [
      `Restarts: ${selectedTrial.search.restart_count} of ${selectedTrial.search.max_restarts}`,
      `Iterations per restart: ${selectedTrial.search.iterations_per_restart.join(", ") || "None"}`,
    ] : []),
    ...(selectedTrial.annealing ? [
      `Stuck at local optimum: ${selectedTrial.annealing.stuck_count} iterations (${(selectedTrial.annealing.stuck_frequency * 100).toFixed(1)}%)`,
    ] : []),
    `File: ${runData.result_file}`,
  ].join("\n");
  elements.resultJson.textContent = JSON.stringify({
    result_file: runData.result_file,
    run_summary: runData.summary,
    trial: selectedTrial,
  }, null, 2);
  elements.fitnessChartSection.hidden = false;
  elements.fitnessChartLegend.textContent = selectedTrial.genetic
    ? "Solid = max; dashed = average"
    : "Objective score";
  drawFitnessChart(selectedTrial);
  elements.annealingChartSection.hidden = !selectedTrial.annealing;
  if (selectedTrial.annealing) {
    drawAnnealingChart(selectedTrial.annealing);
  }
  renderDeck(selectedTrial.final_state);
}

function drawAnnealingChart(annealing) {
  const canvas = elements.annealingChart;
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = 240;
  const left = 55;
  const right = 18;
  const top = 18;
  const bottom = 48;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;

  if (width <= 0) return;
  canvas.width = width;
  canvas.height = height;
  context.font = "12px system-ui";
  context.fillStyle = "#222";
  context.strokeStyle = "#888";
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, height - bottom);
  context.lineTo(width - right, height - bottom);
  context.stroke();
  context.fillText("1", 32, top + 4);
  context.fillText("0", 32, height - bottom + 4);
  context.fillText("0", left - 3, height - bottom + 16);
  context.textAlign = "right";
  context.fillText(String(annealing.eET_history.length), width - right, height - bottom + 16);
  context.textAlign = "center";
  context.fillText("Iteration", left + plotWidth / 2, height - 4);
  context.save();
  context.translate(12, top + plotHeight / 2);
  context.rotate(-Math.PI / 2);
  context.fillText("exp(delta / T)", 0, 0);
  context.restore();

  context.fillStyle = "#222";
  annealing.eET_history.forEach((value, index) => {
    if (value === null) return;
    const x = left + (index + 1) / Math.max(annealing.eET_history.length, 1) * plotWidth;
    const y = height - bottom - value * plotHeight;
    context.fillRect(x - 2, y - 2, 4, 4);
  });
}

function drawFitnessChart(trial) {
  const canvas = elements.fitnessChart;
  const context = canvas.getContext("2d");
  const width = canvas.clientWidth;
  const height = 240;
  const history = trial.search.objective_history;
  const iterations = trial.search.iteration_history;
  const averageHistory = trial.genetic ? trial.genetic.avg_fitness_history : null;
  const values = averageHistory ? [...history, ...averageHistory] : history;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const valueRange = maximum - minimum || 1;
  const maxIteration = Math.max(...iterations, 1);
  const left = 65;
  const right = 12;
  const top = 12;
  const bottom = 48;

  canvas.width = width;
  canvas.height = height;
  context.clearRect(0, 0, width, height);
  context.font = "12px system-ui";
  context.fillStyle = "#222";
  context.strokeStyle = "#888";
  context.beginPath();
  context.moveTo(left, top);
  context.lineTo(left, height - bottom);
  context.lineTo(width - right, height - bottom);
  context.stroke();
  context.fillText(maximum.toFixed(2), 24, top + 4);
  context.fillText(minimum.toFixed(2), 24, height - bottom);
  context.fillText("0", left - 3, height - bottom + 16);
  context.fillText(String(maxIteration), width - right - 20, height - bottom + 16);

  context.save();
  context.translate(12, height / 2);
  context.rotate(-Math.PI / 2);
  context.textAlign = "center";
  context.fillText("Objective value", 0, 0);
  context.restore();

  context.textAlign = "center";
  const xAxisLabel = trial.algorithm === "brute_force" ? "States checked" : "Iteration";
  context.fillText(xAxisLabel, width / 2, height - 4);
  context.textAlign = "left";

  const histories = [[history, []]];
  if (averageHistory) {
    histories.push([averageHistory, [5, 4]]);
  }

  for (const [values, dash] of histories) {
    context.beginPath();
    context.strokeStyle = "#222";
    context.lineWidth = 2;
    context.setLineDash(dash);

    values.forEach((value, index) => {
      const x = left + iterations[index] / maxIteration * (width - left - right);
      const y = height - bottom - (value - minimum) / valueRange * (height - top - bottom);
      if (index === 0) {
        context.moveTo(x, y);
      } else {
        context.lineTo(x, y);
      }
    });

    context.stroke();
  }

  context.setLineDash([]);
}
