const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("starting a run can lock every editor control before sending the request", () => {
  const root = __dirname;
  const html = fs.readFileSync(path.join(root, "src/templates/index.html"), "utf8");
  const source = fs.readFileSync(path.join(root, "src/static/js/app.js"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const nodes = new Map(ids.map((id) => [id, {
    disabled: false,
    addEventListener() {},
    querySelectorAll() { return []; },
  }]));
  const context = {
    document: { getElementById: (id) => nodes.get(id) || null },
    window: { addEventListener() {} },
  };

  vm.runInNewContext(source.replace(/\binitialize\(\);\s*$/, ""), context);
  vm.runInNewContext("setInputsDisabled(true)", context);

  assert.equal(nodes.get("validate-button").disabled, true);
  assert.equal(nodes.get("run-button").disabled, true);
});

test("placing one vehicle produces a complete independent candidate state", () => {
  const html = fs.readFileSync(path.join(__dirname, "src/templates/index.html"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "src/static/js/app.js"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const nodes = new Map(ids.map((id) => [id, { addEventListener() {}, querySelectorAll() { return []; } }]));
  const context = { document: { getElementById: (id) => nodes.get(id) || null }, window: { addEventListener() {} } };
  vm.runInNewContext(source.replace(/\binitialize\(\);\s*$/, ""), context);

  const original = { placements: { A: null, B: { x: 0, y: 0, rotated: false } } };
  context.original = original;
  const candidate = vm.runInNewContext("candidateWithPlacement(original, 'A', {x: 2, y: 1, rotated: true})", context);

  assert.deepEqual(JSON.parse(JSON.stringify(candidate)), {
    placements: { A: { x: 2, y: 1, rotated: true }, B: { x: 0, y: 0, rotated: false } },
  });
  assert.equal(original.placements.A, null);
});

test("an algorithm run sends a validated manual start state when one is selected", () => {
  const html = fs.readFileSync(path.join(__dirname, "src/templates/index.html"), "utf8");
  const source = fs.readFileSync(path.join(__dirname, "src/static/js/app.js"), "utf8");
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  const nodes = new Map(ids.map((id) => [id, { value: "", addEventListener() {}, querySelectorAll() { return []; } }]));
  nodes.get("algorithm-select").value = "steepest";
  nodes.get("objective-select").value = "fee";
  nodes.get("seed-input").value = "42";
  const context = { document: { getElementById: (id) => nodes.get(id) || null }, window: { addEventListener() {} } };
  vm.runInNewContext(source.replace(/\binitialize\(\);\s*$/, ""), context);
  vm.runInNewContext(`
    getProblem = () => ({ ship: { width: 2, length: 1, max_capacity: 2 }, vehicles: [{ id: "A", width: 1, length: 1, weight: 1, shipping_fee: 5, eta: 0 }] });
    editorState = { placements: { A: { x: 1, y: 0, rotated: false } } };
    hasCustomInitialState = true;
  `, context);

  const payload = vm.runInNewContext("algorithmPayload()", context);

  assert.deepEqual(JSON.parse(JSON.stringify(payload.state)), { placements: { A: { x: 1, y: 0, rotated: false } } });
  assert.equal(payload.algorithm, "steepest");
  assert.equal(payload.seed, 42);
});
