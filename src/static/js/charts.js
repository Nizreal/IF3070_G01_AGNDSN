export function drawAnnealingChart(canvas, annealing) {
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

export function drawFitnessChart(canvas, trial) {
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
