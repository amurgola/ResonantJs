#!/usr/bin/env node
// Browser benchmark runner for ResonantJs.
//
// Drives bench/scenarios.js in headless Chromium through Playwright and wraps
// every measured interaction with Chrome DevTools Performance metrics, so each
// scenario reports:
//   - wall time (run / frame), CPU time (script / task), layout and style
//     recalculation counts and durations
//   - DOM mutations (nodes added / removed, attribute and text changes) and
//     rendered element count: deterministic, so any increase is a real change
//   - retained JS heap after a forced GC
//
// Usage
//   node bench/run.js                         benchmark resonant.js
//   node bench/run.js --against origin/main   A/B this checkout vs a git ref
//   node bench/run.js --save-baseline         record bench/baseline.json
//   node bench/run.js --compare               compare against bench/baseline.json
//   node bench/run.js --file resonant.min.js --iterations 9 --warmup 2 --filter "1,000"
//   node bench/run.js --json out.json --summary $GITHUB_STEP_SUMMARY
//
// Exit code is 1 when a comparison finds a deterministic regression (more DOM
// mutations or elements). Timing and heap regressions beyond --threshold
// (default 20%) are reported, and also fail with --strict.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(__dirname, 'results');
const DEFAULT_BASELINE = path.join(__dirname, 'baseline.json');

// ── CLI ──────────────────────────────────────────────────────────────
function parseArgs(argv) {
    const opts = { files: [], iterations: 5, warmup: 1, filter: '', threshold: 20, strict: false };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        const next = () => argv[++i];
        const optionalNext = () => (argv[i + 1] && !argv[i + 1].startsWith('--')) ? argv[++i] : undefined;
        switch (arg) {
            case '--file': opts.files.push(next()); break;
            case '--against': opts.against = next(); break;
            case '--iterations': opts.iterations = Number(next()); break;
            case '--warmup': opts.warmup = Number(next()); break;
            case '--filter': opts.filter = next(); break;
            case '--threshold': opts.threshold = Number(next()); break;
            case '--strict': opts.strict = true; break;
            case '--save-baseline': opts.saveBaseline = optionalNext() || DEFAULT_BASELINE; break;
            case '--compare': opts.compare = optionalNext() || DEFAULT_BASELINE; break;
            case '--json': opts.json = next(); break;
            case '--summary': opts.summary = next(); break;
            case '--help': case '-h': opts.help = true; break;
            default: throw new Error('Unknown option: ' + arg);
        }
    }
    if (!opts.files.length) opts.files.push('resonant.js');
    return opts;
}

function usage() {
    console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}

// ── Library sources ──────────────────────────────────────────────────
function materializeGitRef(ref) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
    const safe = ref.replace(/[^A-Za-z0-9_.-]+/g, '_');
    const target = path.join(RESULTS_DIR, `resonant.${safe}.js`);
    const source = execFileSync('git', ['show', `${ref}:resonant.js`], { cwd: REPO_ROOT, encoding: 'utf8' });
    fs.writeFileSync(target, source);
    return { label: ref, file: target };
}

// ── Metrics ──────────────────────────────────────────────────────────
const METRICS = [
    { key: 'runMs',            label: 'run ms',       kind: 'timing', unit: 'ms' },
    { key: 'frameMs',          label: 'frame ms',     kind: 'timing', unit: 'ms' },
    { key: 'scriptMs',         label: 'script ms',    kind: 'timing', unit: 'ms' },
    { key: 'taskMs',           label: 'task ms',      kind: 'timing', unit: 'ms' },
    { key: 'layoutCount',      label: 'layouts',      kind: 'count' },
    { key: 'recalcStyleCount', label: 'style recalcs', kind: 'count' },
    { key: 'nodesAdded',       label: 'nodes +',      kind: 'strict' },
    { key: 'nodesRemoved',     label: 'nodes −',      kind: 'strict' },
    { key: 'attributeChanges', label: 'attr Δ',       kind: 'strict' },
    { key: 'textChanges',      label: 'text Δ',       kind: 'strict' },
    { key: 'domNodes',         label: 'elements',     kind: 'strict' },
    { key: 'heapKb',           label: 'heap KB',      kind: 'memory', unit: 'KB' },
];

const median = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

const toMap = (metrics) => Object.fromEntries(metrics.metrics.map((m) => [m.name, m.value]));

function summarizeSamples(name, samples) {
    const row = { name, iterations: samples.length };
    for (const { key } of METRICS) row[key] = median(samples.map((s) => s[key]));
    const first = samples[0];
    row.stable = samples.every((s) => METRICS.filter((m) => m.kind === 'strict').every(({ key }) => s[key] === first[key]));
    return row;
}

// ── Browser session ──────────────────────────────────────────────────
async function benchmarkFile({ label, file }, opts, browser) {
    const page = await browser.newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Performance.enable');
    await cdp.send('HeapProfiler.enable');

    await page.setContent('<!DOCTYPE html><html><head><meta charset="utf-8"></head><body></body></html>');
    for (const script of [file, path.join(__dirname, 'scenarios.js'), path.join(__dirname, 'harness.js')]) {
        await page.addScriptTag({ path: script });
    }
    const names = (await page.evaluate(() => ResonantBench.scenarioNames())).filter((n) => n.includes(opts.filter));

    const rows = [];
    for (const name of names) {
        const samples = [];
        let failure = null;
        // Warm-up iterations run the scenario (JIT, caches) but are discarded.
        const total = opts.warmup + opts.iterations;
        for (let i = 0; i < total && !failure; i++) {
            try {
            await page.evaluate((n) => ResonantBench.prepare(n), name);
            await cdp.send('HeapProfiler.collectGarbage');
            const before = toMap(await cdp.send('Performance.getMetrics'));

            const inPage = await page.evaluate(() => ResonantBench.execute());

            const after = toMap(await cdp.send('Performance.getMetrics'));
            await cdp.send('HeapProfiler.collectGarbage');
            const retained = toMap(await cdp.send('Performance.getMetrics'));

            if (i >= opts.warmup) samples.push({
                runMs: inPage.runMs,
                frameMs: inPage.frameMs,
                scriptMs: (after.ScriptDuration - before.ScriptDuration) * 1000,
                taskMs: (after.TaskDuration - before.TaskDuration) * 1000,
                layoutCount: after.LayoutCount - before.LayoutCount,
                recalcStyleCount: after.RecalcStyleCount - before.RecalcStyleCount,
                nodesAdded: inPage.mutations.nodesAdded,
                nodesRemoved: inPage.mutations.nodesRemoved,
                attributeChanges: inPage.mutations.attributeChanges,
                textChanges: inPage.mutations.textChanges,
                domNodes: inPage.domNodes,
                heapKb: (retained.JSHeapUsedSize - before.JSHeapUsedSize) / 1024,
            });
          } catch (err) {
            // An older version may lack an API a scenario uses; keep going so
            // the rest of the comparison is still useful.
            failure = String(err.message || err).split('\n')[0];
          }
          await page.evaluate(() => ResonantBench.teardown());
        }
        const row = failure ? { name, iterations: 0, stable: true, error: failure } : summarizeSamples(name, samples);
        rows.push(row);
        process.stderr.write(`  ${label}: ${name}${failure ? '  ✗ ' + failure : ''}\n`);
    }
    await page.close();
    return { label, file: path.relative(REPO_ROOT, file), rows };
}

// ── Comparison ───────────────────────────────────────────────────────
function compareRuns(base, head, opts) {
    const findings = [];
    for (const headRow of head.rows) {
        const baseRow = base.rows.find((r) => r.name === headRow.name);
        if (!baseRow) continue;
        for (const metric of METRICS) {
            const b = baseRow[metric.key], h = headRow[metric.key];
            if (typeof b !== 'number' || typeof h !== 'number') continue;
            const delta = h - b;
            const pct = b === 0 ? (h === 0 ? 0 : Infinity) : (delta / Math.abs(b)) * 100;
            let verdict = 'same';
            if (metric.kind === 'strict') {
                if (delta > 0) verdict = 'regression';
                else if (delta < 0) verdict = 'improvement';
            } else {
                // Ignore noise-sized absolute changes before applying the percentage.
                const floor = metric.kind === 'timing' ? 1 : metric.kind === 'memory' ? 256 : 1;
                if (Math.abs(delta) >= floor && Math.abs(pct) >= opts.threshold) {
                    verdict = delta > 0 ? 'regression' : 'improvement';
                }
            }
            findings.push({ scenario: headRow.name, metric, base: b, head: h, delta, pct, verdict });
        }
    }
    return findings;
}

// ── Reporting ────────────────────────────────────────────────────────
const fmt = (metric, value) => {
    if (typeof value !== 'number' || !isFinite(value)) return String(value);
    if (metric.kind === 'timing') return value.toFixed(2);
    if (metric.kind === 'memory') return value.toFixed(0);
    return String(Math.round(value));
};

function renderRunTable(run) {
    const header = ['Scenario', ...METRICS.map((m) => m.label)];
    const lines = [header.join(' | '), header.map(() => '---').join(' | ')];
    for (const row of run.rows) {
        if (row.error) { lines.push([row.name, '✗ ' + row.error, ...METRICS.slice(1).map(() => '')].join(' | ')); continue; }
        lines.push([row.name + (row.stable ? '' : ' ⚠ unstable'), ...METRICS.map((m) => fmt(m, row[m.key]))].join(' | '));
    }
    return lines.join('\n');
}

function renderComparison(findings, baseLabel, headLabel) {
    const changed = findings.filter((f) => f.verdict !== 'same');
    if (!changed.length) return `No metric moved beyond the threshold between ${baseLabel} and ${headLabel}.`;
    const lines = [
        `Scenario | Metric | ${baseLabel} | ${headLabel} | Δ | Verdict`,
        '--- | --- | --- | --- | --- | ---',
    ];
    for (const f of changed) {
        const pct = isFinite(f.pct) ? `${f.pct > 0 ? '+' : ''}${f.pct.toFixed(1)}%` : 'new';
        const icon = f.verdict === 'regression' ? '🔴' : '🟢';
        lines.push(`${f.scenario} | ${f.metric.label} | ${fmt(f.metric, f.base)} | ${fmt(f.metric, f.head)} | ${pct} | ${icon} ${f.verdict}`);
    }
    return lines.join('\n');
}

// Markdown tables double as readable console output once the pipes are aligned.
function printMarkdownTable(markdown) {
    const rows = markdown.split('\n').map((l) => l.split(' | '));
    const widths = rows[0].map((_, i) => Math.max(...rows.map((r) => (r[i] || '').length)));
    for (const row of rows) {
        if (row.every((c) => c === '---')) continue;
        console.log(row.map((c, i) => (i === 0 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  '));
    }
}

function environmentInfo(browser) {
    return {
        createdAt: new Date().toISOString(),
        node: process.version,
        chromium: browser.version(),
        platform: `${os.platform()} ${os.arch()}`,
        cpu: (os.cpus()[0] || {}).model || 'unknown',
    };
}

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
    const opts = parseArgs(process.argv.slice(2));
    if (opts.help) { usage(); return 0; }

    const { chromium } = require('playwright');
    const browser = await chromium.launch({ headless: true, args: ['--enable-precise-memory-info'] });
    const env = environmentInfo(browser);
    console.log(`ResonantJs benchmark · Chromium ${env.chromium} · ${env.cpu} · ${opts.iterations} iterations (median) after ${opts.warmup} warm-up\n`);

    const targets = opts.files.map((f) => ({ label: path.basename(f), file: path.resolve(REPO_ROOT, f) }));
    if (opts.against) targets.unshift(materializeGitRef(opts.against));

    const runs = [];
    for (const target of targets) runs.push(await benchmarkFile(target, opts, browser));
    await browser.close();

    const report = [];
    for (const run of runs) {
        report.push(`### ${run.label} (${run.file})\n\n${renderRunTable(run)}\n`);
        console.log(`\n${run.label} (${run.file})`);
        printMarkdownTable(renderRunTable(run));
    }

    let exitCode = 0;
    const comparisons = [];
    if (opts.against) comparisons.push({ base: runs[0], head: runs[1] });
    if (opts.compare) {
        const baseline = JSON.parse(fs.readFileSync(opts.compare, 'utf8'));
        comparisons.push({ base: { label: 'baseline', rows: baseline.rows }, head: runs[runs.length - 1] });
    }
    for (const { base, head } of comparisons) {
        const findings = compareRuns(base, head, opts);
        const text = renderComparison(findings, base.label, head.label);
        report.push(`### ${base.label} → ${head.label}\n\n${text}\n`);
        console.log(`\n${base.label} → ${head.label}`);
        printMarkdownTable(text);
        const regressions = findings.filter((f) => f.verdict === 'regression');
        const hard = regressions.filter((f) => f.metric.kind === 'strict' || opts.strict);
        if (regressions.length) {
            console.log(`\n${regressions.length} regression(s), ${hard.length} failing (${opts.strict ? 'strict mode' : 'deterministic metrics only'})`);
        }
        if (hard.length) exitCode = 1;
    }

    const last = runs[runs.length - 1];
    if (opts.saveBaseline) {
        fs.writeFileSync(opts.saveBaseline, JSON.stringify({ ...env, iterations: opts.iterations, file: last.file, rows: last.rows }, null, 2) + '\n');
        console.log(`\nBaseline written to ${path.relative(REPO_ROOT, opts.saveBaseline)}`);
    }
    if (opts.json) {
        fs.mkdirSync(path.dirname(path.resolve(opts.json)), { recursive: true });
        fs.writeFileSync(opts.json, JSON.stringify({ ...env, iterations: opts.iterations, runs }, null, 2) + '\n');
    }
    if (opts.summary) {
        fs.appendFileSync(opts.summary, `## ResonantJs benchmark\n\nChromium ${env.chromium} · ${env.cpu} · ${opts.iterations} iterations (median)\n\n${report.join('\n')}\n`);
    }
    return exitCode;
}

main().then((code) => process.exit(code)).catch((err) => { console.error(err); process.exit(2); });
