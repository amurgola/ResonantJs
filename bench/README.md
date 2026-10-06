# Benchmarks

Browser benchmarks for ResonantJs. They answer one question for every change: did a user-visible interaction get faster or cheaper, or did it regress?

## What is measured

Every scenario runs in headless Chromium. The in-page harness measures the interaction itself, and the Node runner wraps it with Chrome DevTools metrics.

| Metric | Source | Meaning |
|---|---|---|
| run ms | `performance.now()` | JS time until the batched update has flushed |
| frame ms | `performance.now()` | time until the next animation frame, so style, layout and paint included |
| script ms, task ms | DevTools `Performance` | CPU time spent in script and in the whole task |
| layouts, style recalcs | DevTools `Performance` | how many times the browser had to lay out or restyle |
| nodes +, nodes −, attr Δ, text Δ | `MutationObserver` | DOM work done: elements added or removed, attribute and text writes |
| elements | `querySelectorAll('*')` | rendered DOM size after the interaction |
| heap KB | DevTools after a forced GC | JS memory the rendered state retains |

The mutation and element counts are deterministic. If they go up between two versions, the change made ResonantJs do more DOM work, whatever the timings say. Timings are medians over the iterations and are only compared beyond a threshold.

## Running

```bash
npx playwright install chromium              # once per machine
npm run bench                                # resonant.js, 5 iterations
npm run bench:compare                        # A/B this checkout vs origin/main
node bench/run.js --against HEAD~1           # A/B vs any git ref
node bench/run.js --file resonant.min.js     # another bundle
node bench/run.js --filter "1,000" --iterations 9
node bench/run.js --save-baseline            # record bench/baseline.json for this machine
node bench/run.js --compare                  # compare against that baseline
node bench/run.js --strict                   # timing regressions also fail
```

`--against` is the comparison to trust: both versions run in the same browser on the same machine within the same minute. A saved baseline is only comparable on the machine that produced it.

Exit code 1 means a deterministic regression (more mutations or elements). Timing and heap moves beyond `--threshold` (default 20%) are reported, and fail only with `--strict`. `--summary` appends a Markdown report, which the Benchmark workflow writes to the job summary on every pull request. `bench/benchmark.html` runs the same scenarios inside a normal browser tab without DevTools metrics.

## Scenarios

Defined in `scenarios.js`. Each has an unmeasured `setup(root, R)` that builds markup and starting data, and a measured `run(root, R)` that performs the interaction. `R` is a fresh `Resonant` instance bound to a fresh root with `bindToWindow: false`, so variables are read as `R.items`.

- Initial renders: a 1,000-item list, the same list through a `res-use` template, nested arrays
- Single-item edits in a 1,000-item list: a text property, a `res-display` / `res-style` toggle, a push into a nested array
- Bulk array changes: push 100, splice one, `update()`, `filterInPlace()`, `sort()`
- Scalars: 1,000 writes in one tick, 200 writes across ticks, a 500-chunk `stream()` through `format()`
- Derived state: a computed total over 1,000 items, `bindByCssSelector` fan-out to 200 targets

To add one, push an object with `name`, `setup` and `run` onto `window.ResonantBenchScenarios`. Await a `setTimeout(0)` at the end of `run` when the change goes through the batched update path, so the flush is inside the measurement.
