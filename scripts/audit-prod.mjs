// CI gate: fails on high or critical advisories in production dependencies (npm audit --omit=dev),
// except advisories reviewed and accepted below, each with its reason. Usage: node scripts/audit-prod.mjs
import { spawnSync } from 'node:child_process';

const ACCEPTED = {
  // deepmerge-ts < 8, used only by the Prisma CLI (prisma -> @prisma/config) to merge Prisma's own
  // config file, so no user input reaches it. prisma 6.19.3 is the latest 6.x and pins 7.1.5, and an npm
  // override is not applied to the existing lockfile. Remove once Prisma ships deepmerge-ts 8.
  'GHSA-ggr8-5vv4-36mx': 'deepmerge-ts stack exhaustion (Prisma CLI config loading only)',
};
const FAIL_ON = new Set(['high', 'critical']);

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const audit = spawnSync(npm, ['audit', '--omit=dev', '--json'], {
  encoding: 'utf8',
  shell: process.platform === 'win32',
});
const report = JSON.parse(audit.stdout);

const advisories = new Map();
for (const vuln of Object.values(report.vulnerabilities ?? {})) {
  for (const via of vuln.via) {
    if (typeof via === 'object') advisories.set(via.url.split('/').pop(), via);
  }
}

let failed = false;
for (const [id, a] of advisories) {
  if (!FAIL_ON.has(a.severity)) continue;
  if (ACCEPTED[id]) {
    console.log(`accepted ${a.severity}: ${id} ${a.name} – ${ACCEPTED[id]}`);
  } else {
    console.log(`FAIL ${a.severity}: ${id} ${a.name} – ${a.title} (${a.url})`);
    failed = true;
  }
}
for (const id of Object.keys(ACCEPTED)) {
  if (!advisories.has(id)) console.log(`note: ${id} no longer reported; remove it from ACCEPTED.`);
}
console.log(failed ? 'Dependency audit failed.' : 'Dependency audit passed.');
process.exit(failed ? 1 : 0);
