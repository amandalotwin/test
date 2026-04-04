#!/usr/bin/env node

/**
 * Run all code cleanliness audits and produce a combined report.
 *
 * Usage:
 *   node scripts/audit-all.mjs [--max-age-days=90]
 *
 * Runs:
 *   1. Feature flag audit
 *   2. Dead code audit
 *
 * Exit codes:
 *   0 - Everything clean
 *   1 - Issues found in one or more audits
 */

import { execSync } from 'child_process';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPTS = resolve(__dirname);

const extraArgs = process.argv.slice(2).join(' ');
let exitCode = 0;

function run(label, script) {
  console.log(`\n${'#'.repeat(60)}`);
  console.log(`#  ${label}`);
  console.log(`${'#'.repeat(60)}`);

  try {
    const output = execSync(`node ${resolve(SCRIPTS, script)} ${extraArgs}`, {
      encoding: 'utf-8',
      timeout: 120000,
      stdio: 'pipe',
    });
    console.log(output);
  } catch (err) {
    console.log(err.stdout || '');
    if (err.stderr) console.error(err.stderr);
    exitCode = 1;
  }
}

console.log('=== Code Cleanliness Audit ===');
console.log(`Date: ${new Date().toISOString()}\n`);

run('Feature Flag Audit', 'audit-flags.mjs');
run('Dead Code Audit', 'audit-dead-code.mjs');

console.log(`\n${'#'.repeat(60)}`);
if (exitCode === 0) {
  console.log('#  ALL AUDITS PASSED');
} else {
  console.log('#  ISSUES FOUND - Please review above');
}
console.log(`${'#'.repeat(60)}\n`);

process.exit(exitCode);
