#!/usr/bin/env node
// Release preflight. Reads the version from package.json and reports whether
// that version is already published to npm and whether its git tag exists,
// so the Release workflow can decide what is left to do and never republish
// or re-tag. Prints key=value lines, and appends them to $GITHUB_OUTPUT when
// running inside GitHub Actions.
//
//   node scripts/release-check.js                report only
//   node scripts/release-check.js --strict       exit 1 when nothing is left to release
//   node scripts/release-check.js --npm-version  exit 1 unless npm is 11.5.1+ (trusted publishing)
//   node scripts/release-check.js --oidc-claims  in GitHub Actions: fetch the job's OIDC token for
//                                                npm, print the claims npm matches against the
//                                                trusted publisher (repository, workflow, ref ...),
//                                                then perform npm's token exchange and fail with
//                                                the registry's message if it is rejected
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const MIN_NPM_FOR_TRUSTED_PUBLISHING = '11.5.1';

function run(cmd, args) {
    try { return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch (_) { return ''; }
}

const atLeast = (version, minimum) => {
    const a = version.split('.').map(Number), b = minimum.split('.').map(Number);
    for (let i = 0; i < 3; i++) { if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0); }
    return true;
};

if (process.argv.includes('--npm-version')) {
    const npmVersion = run('npm', ['--version']);
    console.log(`npm=${npmVersion}`);
    if (!atLeast(npmVersion, MIN_NPM_FOR_TRUSTED_PUBLISHING)) {
        console.error(`npm ${npmVersion} cannot use trusted publishing; ${MIN_NPM_FOR_TRUSTED_PUBLISHING} or newer is required (Node 24 bundles it, or run: npm install -g npm@latest)`);
        process.exit(1);
    }
    process.exit(0);
}

// Trusted publishing fails silently inside npm when the registry rejects the
// OIDC exchange: npm logs the rejection only at verbose level, falls back to
// whatever token is configured, and the publish dies with an unexplained 404.
// This repeats npm's exchange (POST /-/npm/v1/oidc/token/exchange/package/<name>
// with the id token as a bearer) so the registry's real answer is visible, and
// shows the token's claims so a mismatch with the npmjs.com trusted publisher
// is obvious. Neither the id token nor the exchanged token is ever printed.
function oidcClaims() {
    const url = process.env.ACTIONS_ID_TOKEN_REQUEST_URL;
    const bearer = process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
    if (!url || !bearer) {
        console.error('No OIDC token is available to this job: the workflow was not granted "id-token: write". '
            + 'Check the permissions block, then Settings → Actions → General → Workflow permissions, and any organization policy.');
        process.exit(1);
    }
    (async () => {
        const audience = 'npm:registry.npmjs.org';
        const res = await fetch(`${url}&audience=${encodeURIComponent(audience)}`, { headers: { Authorization: `bearer ${bearer}` } });
        if (!res.ok) { console.error(`OIDC token request failed: HTTP ${res.status}`); process.exit(1); }
        const { value } = await res.json();
        const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
        const shown = ['repository', 'repository_owner', 'workflow_ref', 'job_workflow_ref', 'ref', 'environment', 'event_name', 'aud', 'iss'];
        const rows = shown.map((k) => [k, payload[k] === undefined ? '(absent)' : String(payload[k])]);
        rows.forEach(([k, v]) => console.log(`${k}=${v}`));
        const summary = (text) => { if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text); };
        summary('### OIDC claims presented to npm\n\nThe npmjs.com trusted publisher must match these exactly: '
            + 'organization or user = `repository_owner`, repository = the part of `repository` after the slash, '
            + 'workflow filename = the file in `workflow_ref`, environment = `environment` (blank if absent).\n\n'
            + '| Claim | Value |\n|---|---|\n' + rows.map(([k, v]) => `| ${k} | \`${v}\` |`).join('\n') + '\n\n');

        // The same exchange npm publish performs, so a rejection is explained
        // here instead of surfacing later as an unexplained 404.
        const name = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).name;
        const registry = (process.env.NPM_CONFIG_REGISTRY || 'https://registry.npmjs.org').replace(/\/+$/, '');
        const exchange = await fetch(`${registry}/-/npm/v1/oidc/token/exchange/package/${encodeURIComponent(name)}`, {
            method: 'POST', headers: { Accept: 'application/json', Authorization: `Bearer ${value}` },
        });
        const text = await exchange.text();
        let body = {};
        try { body = JSON.parse(text); } catch (_) { body = { message: text.slice(0, 300) }; }
        if (!exchange.ok || !body.token) {
            const reason = body.message || body.error || '(no message)';
            console.error(`npm rejected the OIDC token exchange for ${name}: HTTP ${exchange.status} ${reason}`);
            console.error('Compare the claims above with the trusted publisher on npmjs.com (package → Settings → Trusted Publisher): '
                + 'organization or user, repository (exact spelling and case), workflow filename and environment must all match, '
                + 'and "npm publish" must be allowed. The required fields cannot be edited there: delete the entry and create it again.');
            summary(`**npm rejected the OIDC token exchange:** HTTP ${exchange.status} ${reason}\n\n`);
            process.exit(1);
        }
        console.log('oidc_exchange=accepted');
        summary('npm accepted the OIDC token exchange: this workflow is a valid trusted publisher for `' + name + '`.\n\n');
    })().catch((err) => { console.error('OIDC claims check failed:', err.message); process.exit(1); });
}
if (process.argv.includes('--oidc-claims')) { oidcClaims(); } else { main(); }

function main() {

const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
const version = pkg.version;
const tag = 'v' + version;

if (!/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/.test(version)) {
    console.error(`package.json version "${version}" is not a valid semver release version`);
    process.exit(1);
}

const published = run('npm', ['view', `${pkg.name}@${version}`, 'version']) === version;
run('git', ['fetch', '--tags', '--quiet']);
const tagged = run('git', ['rev-parse', '--verify', '--quiet', `refs/tags/${tag}`]) !== '';

const out = { name: pkg.name, version, tag, published, tagged };
for (const [key, value] of Object.entries(out)) console.log(`${key}=${value}`);
if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, Object.entries(out).map(([k, v]) => `${k}=${v}\n`).join(''));
}

if (process.argv.includes('--strict') && published && tagged) {
    console.error(`${pkg.name}@${version} is already on npm and ${tag} already exists: bump the version in package.json first`);
    process.exit(1);
}
}
