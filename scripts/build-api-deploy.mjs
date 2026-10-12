// Builds a self-contained API folder for cPanel "Setup Node.js App" hosting (npm workspaces don't
// resolve there): deploy/api/ plus deploy/svi-api.zip to upload. Usage: npm run build:deploy
import { execFileSync, execSync } from 'node:child_process';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const api = path.join(root, 'apps/api');
const shared = path.join(root, 'packages/shared');
const out = path.join(root, 'deploy/api');
const zip = path.join(root, 'deploy/svi-api.zip');

const run = (cmd, cwd = root) => execSync(cmd, { cwd, stdio: 'inherit' });
const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, data) => writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

// Fresh builds, so no stale files from deleted sources end up on the server.
rmSync(path.join(api, 'dist'), { recursive: true, force: true });
rmSync(path.join(shared, 'dist'), { recursive: true, force: true });
run('npm run build -w @svi/shared');
run('npm run build -w @svi/api');

// Empty rather than delete deploy/api: Windows refuses to delete a folder open in Explorer or a shell.
mkdirSync(out, { recursive: true });
for (const entry of readdirSync(out))
  rmSync(path.join(out, entry), { recursive: true, force: true });
rmSync(zip, { force: true });

cpSync(path.join(api, 'dist'), path.join(out, 'dist'), { recursive: true });
cpSync(path.join(api, 'prisma'), path.join(out, 'prisma'), { recursive: true });
cpSync(path.join(api, 'app.cjs'), path.join(out, 'app.cjs'));

// @svi/shared is imported by relative path instead of as a package. CloudLinux's Node.js selector
// keeps node_modules elsewhere (nodevenv) behind a symlink, which breaks npm's file:/link deps.
const sharedPkg = readJson(path.join(shared, 'package.json'));
const sharedEntry = path.join(out, 'shared/dist/index.js');
cpSync(path.join(shared, 'dist'), path.join(out, 'shared/dist'), { recursive: true });
writeJson(path.join(out, 'shared/package.json'), { private: true, type: 'module' });

const jsFiles = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? jsFiles(path.join(dir, e.name))
      : e.name.endsWith('.js')
        ? [path.join(dir, e.name)]
        : [],
  );
for (const file of jsFiles(path.join(out, 'dist'))) {
  const src = readFileSync(file, 'utf8');
  if (!src.includes(`'@svi/shared'`)) continue;
  let rel = path.relative(path.dirname(file), sharedEntry).split(path.sep).join('/');
  if (!rel.startsWith('.')) rel = `./${rel}`;
  writeFileSync(file, src.replaceAll(`'@svi/shared'`, `'${rel}'`));
}

const apiPkg = readJson(path.join(api, 'package.json'));
const rootPkg = readJson(path.join(root, 'package.json'));
writeJson(path.join(out, 'package.json'), {
  name: apiPkg.name,
  version: apiPkg.version,
  private: true,
  type: 'module',
  engines: rootPkg.engines,
  scripts: {
    start: 'node dist/server.js',
    postinstall: 'prisma generate',
    'db:deploy': 'prisma migrate deploy',
    'db:seed:prod': 'node dist/scripts/seed.js',
    'create-admin': 'node dist/scripts/createAdmin.js',
  },
  dependencies: Object.fromEntries(
    Object.entries({ ...sharedPkg.dependencies, ...apiPkg.dependencies }).filter(
      ([name]) => name !== '@svi/shared',
    ),
  ),
});

// Lockfile so the server installs the same versions every time.
run('npm install --package-lock-only --ignore-scripts --no-audit --no-fund', out);

const entries = readdirSync(out);
// Windows' own bsdtar writes zips (Git Bash's GNU tar, which may come first in PATH, cannot).
if (process.platform === 'win32') {
  const tar = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe');
  execFileSync(tar, ['-a', '-cf', zip, ...entries], { cwd: out, stdio: 'inherit' });
} else execFileSync('zip', ['-qr', zip, ...entries], { cwd: out, stdio: 'inherit' });

console.log(`\nDeploy bundle ready:\n  ${out}\n  ${zip}`);
