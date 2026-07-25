#!/usr/bin/env node
/**
 * Ensure `node_modules/electron` actually contains a runnable Electron binary.
 *
 * Why:
 *   electron's own `install.js` extracts its release zip with `extract-zip`
 *   (yauzl). On newer Node versions (reproduced on Node 26.5.0) that promise
 *   never settles: extraction stops after the first archive entry, `install.js`
 *   exits 0, and `path.txt` is never written. Nothing looks wrong until the app
 *   is started and electron's `index.js` throws:
 *
 *     "Electron failed to install correctly, please delete node_modules/electron
 *      and try installing again"
 *
 *   Reinstalling does not help — it fails the same silent way every time.
 *
 *   The download itself is fine (the zip lands in the @electron/get cache), so
 *   this script reuses that cached zip and extracts it with the system `unzip`,
 *   which handles the app bundle's symlinks and executable bits correctly.
 *
 * Idempotent. Safe to run repeatedly. No-op when electron is already healthy.
 */
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = resolve(process.cwd());
const ELECTRON_DIR = join(ROOT, 'node_modules', 'electron');

if (!existsSync(ELECTRON_DIR)) {
  console.log('ensure-electron-binary: electron is not installed, skipping.');
  process.exit(0);
}

if (process.platform === 'win32') {
  console.log('ensure-electron-binary: unsupported on win32, skipping.');
  process.exit(0);
}

const { version } = JSON.parse(readFileSync(join(ELECTRON_DIR, 'package.json'), 'utf8'));
const DIST_DIR = join(ELECTRON_DIR, 'dist');
const PATH_TXT = join(ELECTRON_DIR, 'path.txt');
const platformPath = process.platform === 'darwin' ? 'Electron.app/Contents/MacOS/Electron' : 'electron';

function isInstalled() {
  try {
    if (readFileSync(join(DIST_DIR, 'version'), 'utf8').replace(/^v/, '') !== version) return false;
    if (readFileSync(PATH_TXT, 'utf8') !== platformPath) return false;
  } catch {
    return false;
  }
  return existsSync(join(DIST_DIR, platformPath));
}

if (isInstalled()) {
  console.log(`ensure-electron-binary: electron v${version} binary already present.`);
  process.exit(0);
}

console.log(`ensure-electron-binary: repairing electron v${version} install…`);

const { downloadArtifact } = require('@electron/get');

// Resolves from the local cache when the zip was already fetched; only hits the
// network when the download itself never happened.
const zipPath = await downloadArtifact({
  version,
  artifactName: 'electron',
  platform: process.platform,
  arch: process.arch,
  checksums: JSON.parse(readFileSync(join(ELECTRON_DIR, 'checksums.json'), 'utf8')),
});

execFileSync('unzip', ['-o', '-q', zipPath, '-d', DIST_DIR], { stdio: 'inherit' });

// electron's install.js hoists the bundled type definitions out of dist/.
const srcTypeDefs = join(DIST_DIR, 'electron.d.ts');
if (existsSync(srcTypeDefs)) {
  execFileSync('mv', ['-f', srcTypeDefs, join(ELECTRON_DIR, 'electron.d.ts')]);
}

writeFileSync(PATH_TXT, platformPath);

if (!isInstalled()) {
  console.error(`ensure-electron-binary: extraction finished but ${join(DIST_DIR, platformPath)} is still missing.`);
  process.exit(1);
}

console.log(`ensure-electron-binary: electron v${version} binary restored at ${dirname(join(DIST_DIR, platformPath))}.`);
