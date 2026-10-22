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

export function getProblem(elements) {
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

export function getInitialState(elements) {
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

function addVehicle(elements, vehicle = {}) {
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

export function fillForm(elements, problem, clearResult) {
  if (!problem || !problem.ship || !Array.isArray(problem.vehicles)) {
    throw new Error("JSON must contain ship and vehicles.");
  }

  elements.shipWidth.value = problem.ship.width;
  elements.shipLength.value = problem.ship.length;
  elements.shipCapacity.value = problem.ship.max_capacity;
  elements.vehicleList.replaceChildren();

  for (const vehicle of problem.vehicles) {
    addVehicle(elements, vehicle);
    const row = elements.vehicleList.lastElementChild;
    const placement = problem.initial_state?.placements?.[vehicle.id];
    if (placement !== undefined) setPlacement(row, placement);
  }

  clearResult();
}

function randomizeGrid(elements, clearResult) {
  elements.shipWidth.value = randomInteger(randomSettings.minShipSize, randomSettings.maxShipSize);
  elements.shipLength.value = randomInteger(randomSettings.minShipSize, randomSettings.maxShipSize);

  for (const row of elements.vehicleList.querySelectorAll(".vehicle-row")) {
    setPlacement(row, null);
  }

  clearResult();
}

function randomizeVehicles(elements, clearResult) {
  const vehicleCount = randomInteger(randomSettings.minVehicles, randomSettings.maxVehicles);
  elements.vehicleList.replaceChildren();

  for (let index = 1; index <= vehicleCount; index += 1) {
    addVehicle(elements, {
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

async function randomizePlacements(elements, clearResult, requestJson) {
  elements.runError.textContent = "";

  try {
    const result = await requestJson("/api/random-placements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(getProblem(elements)),
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

async function randomizeInitialState(elements, clearResult, requestJson) {
  randomizeGrid(elements, clearResult);
  randomizeVehicles(elements, clearResult);
  await randomizePlacements(elements, clearResult, requestJson);
}

async function loadProblemFile(elements, event, clearResult) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    fillForm(elements, JSON.parse(await file.text()), clearResult);
    elements.status.textContent = "Loaded " + file.name;
  } catch (error) {
    elements.runError.textContent = "Could not load JSON: " + error.message;
  }

  elements.problemFile.value = "";
}

function saveProblemFile(elements) {
  const problem = {
    ...getProblem(elements),
    initial_state: getInitialState(elements),
  };
  const file = new Blob([JSON.stringify(problem, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "problem.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

export function setupForm(elements, clearResult, requestJson) {
  document.getElementById("add-vehicle").addEventListener("click", () => {
    addVehicle(elements);
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
  elements.problemFile.addEventListener("change", (event) => loadProblemFile(elements, event, clearResult));
  document.getElementById("save-json").addEventListener("click", () => saveProblemFile(elements));
  document.getElementById("randomize-all").addEventListener("click", () => randomizeInitialState(elements, clearResult, requestJson));
  document.getElementById("randomize-grid").addEventListener("click", () => randomizeGrid(elements, clearResult));
  document.getElementById("randomize-vehicles").addEventListener("click", () => randomizeVehicles(elements, clearResult));
  document.getElementById("randomize-placements").addEventListener("click", () => randomizePlacements(elements, clearResult, requestJson));
}
