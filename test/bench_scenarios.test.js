// Guards the benchmark scenario definitions without a browser: every scenario
// has a unique name, an unmeasured setup and a measured run, so bench/run.js
// and bench/benchmark.html can rely on the shape.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const path = require('path');

function loadScenarios() {
  const code = fs.readFileSync(path.join(__dirname, '..', 'bench', 'scenarios.js'), 'utf8');
  const context = { console };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(code, context);
  return context.ResonantBenchScenarios;
}

test('benchmark scenarios are well-formed', () => {
  const scenarios = loadScenarios();
  assert.ok(Array.isArray(scenarios) && scenarios.length > 0, 'scenario list is non-empty');
  for (const scenario of scenarios) {
    assert.strictEqual(typeof scenario.name, 'string', 'scenario has a name');
    assert.ok(scenario.name.trim().length > 0, 'scenario name is not blank');
    assert.strictEqual(typeof scenario.setup, 'function', `${scenario.name}: setup is a function`);
    assert.strictEqual(typeof scenario.run, 'function', `${scenario.name}: run is a function`);
  }
});

test('benchmark scenario names are unique', () => {
  const names = loadScenarios().map((s) => s.name);
  assert.strictEqual(new Set(names).size, names.length, 'no duplicate scenario names');
});

test('benchmark harness and runner parse', () => {
  for (const file of ['harness.js', 'run.js']) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'bench', file), 'utf8');
    assert.doesNotThrow(() => new vm.Script(code, { filename: file }), `${file} is valid JavaScript`);
  }
});
