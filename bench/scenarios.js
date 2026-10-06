// Benchmark scenarios. Each one is a user-visible interaction that ResonantJs
// should keep fast: an initial render, a single-item edit, a bulk change, a
// token stream. They run inside a real browser (see harness.js / run.js), so
// the numbers reflect what a user actually waits for.
//
// Contract: setup(root, R) builds the markup and any starting data, and is
// NOT measured. run(root, R) is the measured interaction. Both receive a
// fresh root element and a fresh Resonant instance bound to it.
(() => {
    const LIST_SIZE = 1000;

    // Wait for ResonantJs' batched flush (a setTimeout(0)), then hop through a
    // MessageChannel task. Browsers clamp timers nested more than five deep to
    // 4ms; the hop resets that nesting so per-tick scenarios measure the
    // framework rather than the clamp, as separate user events would.
    const tick = async () => {
        await new Promise((r) => setTimeout(r, 0));
        await new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
    };

    const makeItems = (count, offset = 0) => Array.from({ length: count }, (_, i) => {
        const n = offset + i;
        return { id: n, name: 'Item ' + n, price: n * 1.5, done: n % 3 === 0 };
    });

    // The per-item template used by most list scenarios: text, a formatted
    // number, a conditional, a dynamic class and an event binding, i.e. the
    // attributes a real list row carries.
    const listMarkup =
        '<ul>' +
        '<li res="items">' +
        '<span res-prop="name"></span>' +
        '<span res-prop="price"></span>' +
        '<span res-display="done">done</span>' +
        '<span res-style="done ? \'is-done\' : \'is-open\'">state</span>' +
        '<button res-onclick="benchNoop">x</button>' +
        '</li>' +
        '</ul>';

    const nestedMarkup =
        '<div res="company.departments">' +
        '<h3 res-prop="name"></h3>' +
        '<div res-prop="teams">' +
        '<span res-prop="name"></span>' +
        '<ul res-prop="members"><li res-prop="name"></li></ul>' +
        '</div>' +
        '</div>';

    const makeCompany = () => ({
        departments: Array.from({ length: 20 }, (_, d) => ({
            name: 'Dept ' + d,
            teams: Array.from({ length: 5 }, (_, t) => ({
                name: 'Team ' + t,
                members: Array.from({ length: 10 }, (_, m) => ({ name: 'Member ' + m })),
            })),
        })),
    });

    const withList = (root, R) => { root.innerHTML = listMarkup; R.add('items', makeItems(LIST_SIZE)); };

    window.ResonantBenchScenarios = [
        {
            name: 'render list: 1,000 items',
            setup(root) { root.innerHTML = listMarkup; },
            run(root, R) { R.add('items', makeItems(LIST_SIZE)); },
        },
        {
            name: 'render list via res-use template: 1,000 items',
            setup(root, R) {
                root.innerHTML = '<ul><li res="items" res-use="row"></li></ul>';
                R.registerTemplate('row',
                    '<li><span res-prop="name"></span><span res-prop="price"></span>' +
                    '<span res-display="done">done</span><button res-onclick="res.open">x</button></li>');
                R.handler('open', () => {});
            },
            run(root, R) { R.add('items', makeItems(LIST_SIZE)); },
        },
        {
            name: 'edit one text property in 1,000 items',
            setup: withList,
            async run(root, R) { R.items[500].name = 'Renamed'; await tick(); },
        },
        {
            name: 'toggle res-display and res-style on one item',
            setup: withList,
            async run(root, R) { R.items[500].done = !R.items[500].done; await tick(); },
        },
        {
            name: 'push 100 items onto 1,000',
            setup: withList,
            async run(root, R) {
                for (let i = 0; i < 100; i++) R.items.push({ id: 9000 + i, name: 'New ' + i, price: i, done: false });
                await tick();
            },
        },
        {
            name: 'splice one item out of the middle of 1,000',
            setup: withList,
            async run(root, R) { R.items.splice(500, 1); await tick(); },
        },
        {
            name: 'replace the whole 1,000-item array with update()',
            setup: withList,
            async run(root, R) { R.items.update(makeItems(LIST_SIZE, 50000)); await tick(); },
        },
        {
            name: 'filterInPlace 1,000 items down to a third',
            setup: withList,
            async run(root, R) { R.items.filterInPlace((item) => item.done); await tick(); },
        },
        {
            name: 'sort 1,000 items in place',
            setup: withList,
            async run(root, R) { R.items.sort((a, b) => b.price - a.price); await tick(); },
        },
        {
            name: '1,000 scalar writes batched into one tick',
            setup(root, R) { root.innerHTML = '<p res="counter"></p>'; R.add('counter', 0); },
            async run(root, R) { for (let i = 1; i <= 1000; i++) R.counter = i; await tick(); },
        },
        {
            name: '200 scalar writes, one per tick',
            setup(root, R) { root.innerHTML = '<p res="counter"></p>'; R.add('counter', 0); },
            async run(root, R) { for (let i = 1; i <= 200; i++) { R.counter = i; await tick(); } },
        },
        {
            name: 'stream 500 chunks through format()',
            setup(root, R) {
                root.innerHTML = '<div res="answer"></div>';
                R.add('answer', '');
                R.format('answer', (text, meta) => '<p>' + text + (meta.done ? '' : '…') + '</p>');
            },
            async run(root, R) {
                const sink = R.stream('answer', { throttle: 0 });
                for (let i = 0; i < 500; i++) {
                    sink.write('token' + i + ' ');
                    if (i % 25 === 24) await tick();   // 20 repaint opportunities, like a real token feed
                }
                sink.end();
                await tick();
            },
        },
        {
            name: 'render nested arrays: 20 × 5 × 10',
            setup(root) { root.innerHTML = nestedMarkup; },
            run(root, R) { R.add('company', makeCompany()); },
        },
        {
            name: 'push one member into a nested array',
            setup(root, R) { root.innerHTML = nestedMarkup; R.add('company', makeCompany()); },
            async run(root, R) { R.company.departments[10].teams[2].members.push({ name: 'Newcomer' }); await tick(); },
        },
        {
            name: 'computed total over 1,000 items after one price edit',
            setup(root, R) {
                root.innerHTML = listMarkup + '<p res="total"></p>';
                R.add('items', makeItems(LIST_SIZE));
                R.computed('total', () => R.items.reduce((sum, item) => sum + item.price, 0));
            },
            async run(root, R) { R.items[250].price = 99; await tick(); },
        },
        {
            name: 'bindByCssSelector: 200 targets, 50 updates',
            setup(root, R) {
                root.innerHTML = '<span res="status"></span>' + '<span class="mirror"></span>'.repeat(200);
                R.add('status', 'idle');
                R.bindByCssSelector('status', '.mirror');
            },
            async run(root, R) { for (let i = 0; i < 50; i++) { R.status = 'state ' + i; await tick(); } },
        },
    ];

    window.benchNoop = () => {};
})();
