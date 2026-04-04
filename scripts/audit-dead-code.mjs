#!/usr/bin/env node

/**
 * Dead Code Audit Script
 *
 * Runs multiple checks to identify dead or redundant code:
 * 1. ESLint unused imports/variables check
 * 2. TypeScript compiler unused locals/parameters check
 * 3. Scans for common dead code patterns (commented-out code blocks,
 *    TODO/FIXME/HACK markers that may indicate temporary code)
 *
 * Usage:
 *   node scripts/audit-dead-code.mjs
 *
 * Exit codes:
 *   0 - No issues found
 *   1 - Issues detected
 */

import { execSync } from 'child_process';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, extname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src');

let hasIssues = false;

function heading(title) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'='.repeat(50)}\n`);
}

// 1. ESLint check
function runEslint() {
  heading('ESLint: Unused Imports & Variables');
  try {
    const output = execSync('npx eslint . --format stylish 2>&1', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
    });
    console.log('  No ESLint issues found.');
  } catch (err) {
    const output = err.stdout || err.stderr || '';
    if (output.includes('error') || output.includes('warning')) {
      console.log(output);
      hasIssues = true;
    } else {
      console.log('  No ESLint issues found.');
    }
  }
}

// 2. TypeScript compiler check
function runTypeCheck() {
  heading('TypeScript: Unused Locals & Parameters');
  try {
    execSync('npx tsc --noEmit 2>&1', {
      cwd: ROOT,
      encoding: 'utf-8',
      timeout: 60000,
    });
    console.log('  No TypeScript issues found.');
  } catch (err) {
    const output = err.stdout || err.stderr || '';
    const unusedLines = output
      .split('\n')
      .filter(
        (line) =>
          line.includes('is declared but') ||
          line.includes('is defined but never used')
      );
    if (unusedLines.length > 0) {
      unusedLines.forEach((l) => console.log(`  ${l.trim()}`));
      hasIssues = true;
    } else if (output.trim()) {
      console.log(output);
      hasIssues = true;
    } else {
      console.log('  No TypeScript issues found.');
    }
  }
}

// 3. Pattern scan for dead code markers
function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === 'node_modules' || entry === 'dist' || entry === '.git') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkDir(full));
    } else if (['.ts', '.tsx', '.js', '.jsx'].includes(extname(full))) {
      results.push(full);
    }
  }
  return results;
}

function scanPatterns() {
  heading('Pattern Scan: Dead Code Markers');

  const patterns = [
    {
      name: 'Commented-out code block',
      regex: /^(\s*\/\/\s*(?:import|export|const|let|var|function|class|if|for|while|return)\b.*)/,
    },
    {
      name: 'TODO/FIXME/HACK marker',
      regex: /\/[/*]\s*(TODO|FIXME|HACK|XXX|DEPRECATED)\b/i,
    },
  ];

  const files = walkDir(SRC);
  let foundCount = 0;

  for (const file of files) {
    const lines = readFileSync(file, 'utf-8').split('\n');
    const relPath = file.replace(ROOT + '/', '');

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.regex.test(lines[i])) {
          if (foundCount === 0) {
            console.log('  Found potential dead code markers:\n');
          }
          console.log(`  ${relPath}:${i + 1}`);
          console.log(`    [${pattern.name}] ${lines[i].trim()}`);
          console.log();
          foundCount++;
        }
      }
    }
  }

  if (foundCount === 0) {
    console.log('  No dead code markers found.');
  } else {
    console.log(`  Total markers found: ${foundCount}`);
    hasIssues = true;
  }
}

// Main
console.log('\n*** Dead Code Audit Report ***');
console.log(`Date: ${new Date().toISOString()}\n`);

runEslint();
runTypeCheck();
scanPatterns();

heading('Summary');
if (hasIssues) {
  console.log('  Issues were detected. Please review the findings above.\n');
  process.exit(1);
} else {
  console.log('  Codebase is clean. No dead code detected.\n');
  process.exit(0);
}
