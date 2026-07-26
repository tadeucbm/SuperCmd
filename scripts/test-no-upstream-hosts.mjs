#!/usr/bin/env node

/**
 * Guards the "no data to upstream SuperCmd infrastructure" rule.
 *
 * Two layers:
 *   1. The blocklist matcher behaves correctly (subdomains, casing, ports).
 *   2. No upstream host is reachable from source — or from dist/, when a build
 *      is present. This is what catches a merged upstream commit or a refactor
 *      quietly reintroducing an endpoint.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Any literal matching this must not appear outside the allowlisted files.
const UPSTREAM_HOST_PATTERN = /\b(?:[a-z0-9-]+\.)*supercmd\.sh\b|\bsupercmd-extensions\.s3[a-z0-9.-]*\.amazonaws\.com\b/gi;

// The blocklist itself necessarily names the hosts it blocks — in source and
// in its compiled output.
const ALLOWLISTED = new Set([
  path.join('src', 'main', 'blocked-hosts.ts'),
  path.join('dist', 'main', 'blocked-hosts.js'),
]);

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json', '.sh', '.yml', '.yaml']);

function walk(dir, onFile) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Swift build artifacts embed the absolute checkout path, which may
      // legitimately contain "SuperCmd" as a directory name. Not a reference.
      if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '.build') continue;
      walk(full, onFile);
    } else if (entry.isFile()) {
      onFile(full);
    }
  }
}

function findUpstreamHostRefs(dir, { filterExtensions }) {
  const hits = [];
  walk(path.join(root, dir), (full) => {
    const relative = path.relative(root, full);
    if (ALLOWLISTED.has(relative)) return;
    if (filterExtensions && !SCANNED_EXTENSIONS.has(path.extname(full))) return;

    let contents;
    try {
      contents = fs.readFileSync(full, 'utf-8');
    } catch {
      return;
    }
    for (const match of contents.matchAll(UPSTREAM_HOST_PATTERN)) {
      hits.push(`${relative}: ${match[0]}`);
    }
  });
  return hits;
}

async function importBlockedHosts() {
  const result = await build({
    entryPoints: [path.join(root, 'src/main/blocked-hosts.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    target: 'node20',
    external: ['electron'],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  return import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`);
}

test('blocklist matches upstream hosts and their subdomains', async () => {
  const { isBlockedUpstreamUrl } = await importBlockedHosts();

  for (const url of [
    'https://api.supercmd.sh',
    'https://api.supercmd.sh/extensions/catalog',
    'https://supercmd.sh',
    'http://API.SuperCmd.SH/auth/linear/authorize',
    'https://api.supercmd.sh:8443/x',
    'https://supercmd-extensions.s3.amazonaws.com/canvas/excalidraw-bundle.tgz',
  ]) {
    assert.equal(isBlockedUpstreamUrl(url), true, `should block ${url}`);
  }
});

test('blocklist does not over-match unrelated hosts', async () => {
  const { isBlockedUpstreamUrl } = await importBlockedHosts();

  for (const url of [
    'https://api.github.com/repos/raycast/extensions',
    'https://raw.githubusercontent.com/raycast/extensions/main/x',
    'https://accounts.spotify.com/authorize',
    'https://api.linear.app/oauth/token',
    // A lookalike host that is not the upstream domain.
    'https://supercmd.sh.example.com/x',
    'https://notsupercmd.sh.evil.test/x',
    '',
    'not a url',
  ]) {
    assert.equal(isBlockedUpstreamUrl(url), false, `should not block ${url}`);
  }
});

test('no upstream host appears in main/renderer source', () => {
  const hits = [
    ...findUpstreamHostRefs('src', { filterExtensions: true }),
    ...findUpstreamHostRefs('canvas-app', { filterExtensions: true }),
  ];
  assert.deepEqual(
    hits,
    [],
    `Upstream SuperCmd hosts must not be referenced in source:\n${hits.join('\n')}`
  );
});

test('no upstream host appears in build output', (t) => {
  if (!fs.existsSync(path.join(root, 'dist'))) {
    t.skip('dist/ not built');
    return;
  }
  const hits = findUpstreamHostRefs('dist', { filterExtensions: false });
  assert.deepEqual(
    hits,
    [],
    `Upstream SuperCmd hosts must not be reachable from the built app:\n${hits.join('\n')}`
  );
});
