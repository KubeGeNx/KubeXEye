#!/usr/bin/env node
'use strict';

/**
 * Pre-flight check run by the Makefile before installing, building, or running anything.
 * Fails fast with a clear message instead of letting Vite/tooling crash with a cryptic error
 * (e.g. "ReferenceError: CustomEvent is not defined" when Vite 8 runs under Node < 20.19).
 *
 * The required versions come from package.json's "engines" field — a single source of truth
 * shared with anything else that reads it (e.g. `npm install` itself warns on a mismatch).
 */

const { execFileSync } = require('node:child_process');
const path = require('node:path');

const pkg = require(path.join(__dirname, '..', 'package.json'));

function parseVersion(v) {
  return v
    .trim()
    .replace(/^v/, '')
    .replace(/^[^\d]*/, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
}

function isAtLeast(current, required) {
  const c = parseVersion(current);
  const r = parseVersion(required);
  for (let i = 0; i < 3; i++) {
    const cn = c[i] ?? 0;
    const rn = r[i] ?? 0;
    if (cn !== rn) return cn > rn;
  }
  return true;
}

function minVersion(range) {
  return (range || '').trim().replace(/^[^\d]*/, '') || '0.0.0';
}

const requiredNode = minVersion(pkg.engines && pkg.engines.node);
const requiredNpm = minVersion(pkg.engines && pkg.engines.npm);

const currentNode = process.versions.node;

let currentNpm = null;
try {
  currentNpm = execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
} catch {
  // npm not on PATH — reported below.
}

let failed = false;

if (!isAtLeast(currentNode, requiredNode)) {
  console.error('');
  console.error(`✖ Node.js ${currentNode} detected — ${pkg.name} requires Node.js >= ${requiredNode} (Vite requires it).`);
  console.error('  Fix: nvm install 22 && nvm use 22   (or upgrade Node.js any other way)');
  console.error('');
  failed = true;
}

if (currentNpm === null) {
  console.error('');
  console.error('✖ npm not found on PATH. It ships with Node.js — reinstall/upgrade Node.js to get it back.');
  console.error('');
  failed = true;
} else if (!isAtLeast(currentNpm, requiredNpm)) {
  console.error('');
  console.error(`✖ npm ${currentNpm} detected — ${pkg.name} requires npm >= ${requiredNpm}.`);
  console.error('  Fix: npm install -g npm@latest');
  console.error('');
  failed = true;
}

if (!failed) {
  console.log(`✓ Node.js ${currentNode}, npm ${currentNpm} — meets the minimum required versions.`);
}

process.exit(failed ? 1 : 0);
