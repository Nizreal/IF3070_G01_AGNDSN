export function renderDeck(elements, problem, state = null) {
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

