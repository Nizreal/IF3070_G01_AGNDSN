import { fillForm, getInitialState, getProblem, setupForm } from "./form.js";
import { drawAnnealingChart, drawFitnessChart } from "./charts.js";
import { renderDeck } from "./deck.js";

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

let runData = null;
let selectedTrial = null;
let runTimer = null;
let runStartedAt = 0;

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
  renderDeck(elements, getProblem(elements), getInitialState(elements));
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
    fillForm(elements, problem, clearResult);
    elements.status.textContent = "Ready";
  } catch (error) {
    elements.status.textContent = "Could not load example: " + error.message;
  }
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
    ...getProblem(elements),
    initial_state: getInitialState(elements),
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
    renderDeck(elements, getProblem(elements), getInitialState(elements));
  } finally {
    clearInterval(runTimer);
    elements.runButton.disabled = false;
  }
}

setupForm(elements, clearResult, requestJson);
elements.runSettings.addEventListener("input", clearResult);
elements.algorithm.addEventListener("change", () => {
  updateAlgorithmFields();
  clearResult();
});
elements.form.addEventListener("submit", runAlgorithm);
elements.trialSelect.addEventListener("change", () => showTrial(Number(elements.trialSelect.value)));
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
    drawFitnessChart(elements.fitnessChart, selectedTrial);
    if (selectedTrial.annealing) drawAnnealingChart(elements.annealingChart, selectedTrial.annealing);
  }

  if (selectedTrial === null) {
    renderDeck(elements, getProblem(elements), getInitialState(elements));
    return;
  }

  renderDeck(elements, getProblem(elements), selectedTrial.final_state);
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
  drawFitnessChart(elements.fitnessChart, selectedTrial);
  elements.annealingChartSection.hidden = !selectedTrial.annealing;
  if (selectedTrial.annealing) {
    drawAnnealingChart(elements.annealingChart, selectedTrial.annealing);
  }
  renderDeck(elements, getProblem(elements), selectedTrial.final_state);
}
