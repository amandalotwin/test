#!/usr/bin/env node

/**
 * Feature Flag Audit Script
 *
 * Scans the flag registry and reports:
 * - Temporary flags past their expiration date
 * - Temporary flags without an expiration date
 * - Flags older than a configurable threshold (default: 90 days)
 * - Summary statistics
 *
 * Usage:
 *   node scripts/audit-flags.mjs [--max-age-days=90]
 *
 * Exit codes:
 *   0 - No stale flags found
 *   1 - Stale flags detected
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REGISTRY_PATH = resolve(__dirname, '../src/flags/registry.ts');

const args = process.argv.slice(2);
const maxAgeDaysArg = args.find((a) => a.startsWith('--max-age-days='));
const MAX_AGE_DAYS = maxAgeDaysArg ? parseInt(maxAgeDaysArg.split('=')[1], 10) : 90;

function parseRegistry(source) {
  const flags = [];
  // Match flag entries in the FLAGS object using a simple regex approach
  const flagPattern =
    /(\w+)\s*:\s*\{[^}]*value\s*:\s*(true|false|['"][^'"]*['"]|\d+)[^}]*description\s*:\s*['"]([^'"]*)['"]/gs;

  // More robust: extract each top-level key in FLAGS
  const flagsBlockMatch = source.match(
    /export\s+const\s+FLAGS\s*:\s*FlagRegistry\s*=\s*\{([\s\S]*?)\};/
  );
  if (!flagsBlockMatch) {
    return flags;
  }

  const block = flagsBlockMatch[1];

  // Find each flag entry
  const entryPattern = /(\w+)\s*:\s*\{([\s\S]*?)\},?\s*(?=\w+\s*:|$)/g;
  let match;
  while ((match = entryPattern.exec(block)) !== null) {
    const name = match[1];
    const body = match[2];

    const getString = (key) => {
      const m = body.match(new RegExp(`${key}\\s*:\\s*['"]([^'"]*)['"]`));
      return m ? m[1] : undefined;
    };

    flags.push({
      name,
      description: getString('description') || '',
      createdAt: getString('createdAt') || '',
      owner: getString('owner') || '',
      ticket: getString('ticket'),
      expiresAt: getString('expiresAt'),
      type: getString('type') || 'temporary',
    });
  }

  return flags;
}

function auditFlags(flags) {
  const now = new Date();
  const stale = [];

  for (const flag of flags) {
    // Check: temporary flag past expiration
    if (flag.type === 'temporary' && flag.expiresAt) {
      const expires = new Date(flag.expiresAt);
      if (now > expires) {
        const daysOverdue = Math.floor((now - expires) / (1000 * 60 * 60 * 24));
        stale.push({
          name: flag.name,
          reason: `Expired ${daysOverdue} day(s) ago (expiresAt: ${flag.expiresAt})`,
          ...flag,
        });
        continue;
      }
    }

    // Check: temporary flag without expiration date
    if (flag.type === 'temporary' && !flag.expiresAt) {
      stale.push({
        name: flag.name,
        reason: 'Temporary flag has no expiresAt date set',
        ...flag,
      });
      continue;
    }

    // Check: flag older than max age
    if (flag.createdAt) {
      const created = new Date(flag.createdAt);
      const ageDays = Math.floor((now - created) / (1000 * 60 * 60 * 24));
      if (ageDays > MAX_AGE_DAYS) {
        stale.push({
          name: flag.name,
          reason: `Flag is ${ageDays} days old (threshold: ${MAX_AGE_DAYS} days)`,
          ...flag,
        });
      }
    }
  }

  return stale;
}

// Main
const source = readFileSync(REGISTRY_PATH, 'utf-8');
const flags = parseRegistry(source);

console.log(`\n=== Feature Flag Audit ===`);
console.log(`Total flags registered: ${flags.length}`);
console.log(`Max age threshold: ${MAX_AGE_DAYS} days\n`);

if (flags.length === 0) {
  console.log('No flags registered. Nothing to audit.\n');
  process.exit(0);
}

const temporary = flags.filter((f) => f.type === 'temporary');
const permanent = flags.filter((f) => f.type === 'permanent');
console.log(`  Temporary flags: ${temporary.length}`);
console.log(`  Permanent flags: ${permanent.length}\n`);

const staleFlags = auditFlags(flags);

if (staleFlags.length === 0) {
  console.log('All flags are healthy. No action needed.\n');
  process.exit(0);
}

console.log(`Found ${staleFlags.length} stale flag(s):\n`);
for (const flag of staleFlags) {
  console.log(`  [STALE] ${flag.name}`);
  console.log(`          Reason: ${flag.reason}`);
  console.log(`          Owner:  ${flag.owner || 'unknown'}`);
  if (flag.ticket) {
    console.log(`          Ticket: ${flag.ticket}`);
  }
  console.log();
}

process.exit(1);
