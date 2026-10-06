// In-page measurement for the benchmark scenarios. Runs in the browser and
// knows nothing about Playwright: run.js drives prepare()/execute() from the
// outside so it can wrap each measured interaction with DevTools metrics,
// and benchmark.html calls runAll() for a self-contained page.
//
// What is measured per interaction:
//   runMs           JS time until ResonantJs' batched update has flushed
//   frameMs         time until the next animation frame (style/layout/paint)
//   mutations       MutationObserver tally: nodes added/removed, attribute
//                   and text changes. Deterministic, so a regression here is
//                   real and not noise.
//   domNodes        elements under the root afterwards (rendered size)
//   heapBytes       JS heap after the interaction (Chromium only, in-page)
(() => {
    const ROOT_ID = 'bench-root';
    const tick = () => new Promise((r) => setTimeout(r, 0));
    const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

    // Versions before 1.3.1 cached array templates on window as
    // <variable>_template, so when an older build is benchmarked (--against) a
    // second run of a scenario would reuse a template from a root that no
    // longer exists. Current builds cache on the element; this is a no-op there.
    function clearTemplateCache() {
        Object.keys(window).filter((key) => key.endsWith('_template')).forEach((key) => { delete window[key]; });
    }

    function freshRoot() {
        const previous = document.getElementById(ROOT_ID);
        if (previous) previous.remove();
        const root = document.createElement('div');
        root.id = ROOT_ID;
        document.body.appendChild(root);
        return root;
    }

    const countElements = (root) => root.querySelectorAll('*').length;

    class MutationTally {
        constructor(root) {
            this.counts = { records: 0, nodesAdded: 0, nodesRemoved: 0, attributeChanges: 0, textChanges: 0 };
            this.observer = new MutationObserver((records) => this.absorb(records));
            this.observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
        }
        absorb(records) {
            for (const record of records) {
                this.counts.records++;
                if (record.type === 'childList') {
                    this.counts.nodesAdded += record.addedNodes.length;
                    this.counts.nodesRemoved += record.removedNodes.length;
                } else if (record.type === 'attributes') {
                    this.counts.attributeChanges++;
                } else {
                    this.counts.textChanges++;
                }
            }
        }
        stop() {
            this.absorb(this.observer.takeRecords());
            this.observer.disconnect();
            return this.counts;
        }
    }

    const median = (values) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    };

    let pending = null;

    const ResonantBench = {
        scenarioNames() { return window.ResonantBenchScenarios.map((s) => s.name); },

        // Build the scenario's starting state. Not measured.
        async prepare(name) {
            const scenario = window.ResonantBenchScenarios.find((s) => s.name === name);
            if (!scenario) throw new Error('Unknown benchmark scenario: ' + name);
            clearTemplateCache();
            const root = freshRoot();
            const R = new Resonant({ rootElement: root, bindToWindow: false });
            await scenario.setup(root, R);
            await tick();
            void root.offsetHeight;             // settle layout before measuring
            await nextFrame();
            pending = { scenario, root, R };
            return { name, domNodesBefore: countElements(root) };
        },

        // Run the measured interaction prepared by prepare(). The instance and
        // root stay referenced until teardown() so a heap reading after this
        // reflects what the rendered state actually retains.
        async execute() {
            if (!pending || pending.executed) throw new Error('execute() called without a fresh prepare()');
            pending.executed = true;
            const { scenario, root, R } = pending;
            const tally = new MutationTally(root);
            const start = performance.now();
            await scenario.run(root, R);
            await tick();                        // let the batched update flush
            const runMs = performance.now() - start;
            void root.offsetHeight;
            await nextFrame();
            const frameMs = performance.now() - start;
            const mutations = tally.stop();
            return {
                name: scenario.name,
                runMs,
                frameMs,
                mutations,
                domNodes: countElements(root),
                heapBytes: performance.memory ? performance.memory.usedJSHeapSize : null,
            };
        },

        teardown() {
            pending = null;
            const root = document.getElementById(ROOT_ID);
            if (root) root.remove();
            clearTemplateCache();
        },

        // Self-contained run for benchmark.html: medians over `iterations`.
        async runAll({ iterations = 5, filter = '', onProgress } = {}) {
            const names = this.scenarioNames().filter((n) => n.includes(filter));
            const rows = [];
            for (const name of names) {
                const samples = [];
                for (let i = 0; i < iterations; i++) {
                    await this.prepare(name);
                    samples.push(await this.execute());
                    if (onProgress) onProgress(name, i + 1, iterations);
                }
                this.teardown();
                rows.push(ResonantBench.summarize(samples));
            }
            return rows;
        },

        // Collapse iteration samples into one row. Timings take the median;
        // deterministic counts take the last sample and flag any drift.
        summarize(samples) {
            const last = samples[samples.length - 1];
            const stable = samples.every((s) => JSON.stringify(s.mutations) === JSON.stringify(last.mutations) && s.domNodes === last.domNodes);
            return {
                name: last.name,
                iterations: samples.length,
                runMs: median(samples.map((s) => s.runMs)),
                frameMs: median(samples.map((s) => s.frameMs)),
                mutations: last.mutations,
                domNodes: last.domNodes,
                heapBytes: last.heapBytes,
                stable,
            };
        },
    };

    window.ResonantBench = ResonantBench;
})();
