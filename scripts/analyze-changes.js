/**
 * Analyzes git diff and categorizes changes into three tiers.
 *
 * Tier 1 (Devin Automatic): Renames, field/param changes, constant updates
 * Tier 2 (Needs Review): New functionality, description changes, release notes
 * Tier 3 (Human Only): Dependency changes, major API/structural changes, metrics changes
 *
 * Outputs JSON to stdout: { tier1: [...], tier2: [...], tier3: [...] }
 */

const { execSync } = require('child_process');

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function analyzeChanges() {
  const tier1 = [];
  const tier2 = [];
  const tier3 = [];

  // Get list of changed files vs previous commit
  const nameStatus = run('git diff HEAD~1 --name-status');
  if (!nameStatus) {
    // No previous commit or no changes
    return { tier1, tier2, tier3 };
  }

  const changedFiles = nameStatus.split('\n').filter(Boolean);

  for (const line of changedFiles) {
    const parts = line.split('\t');
    const status = parts[0];
    const file = parts[parts.length - 1];
    const oldFile = parts.length > 2 ? parts[1] : null;

    // ── Tier 3: Dependency changes ──
    if (file === 'package.json' || file === 'package-lock.json') {
      const diff = run(`git diff HEAD~1 -- "${file}"`);
      if (diff.includes('"dependencies"') || diff.includes('"devDependencies"')) {
        tier3.push({
          type: 'dependency_change',
          file,
          description: `Dependencies changed in ${file}`,
        });
      }
      continue;
    }

    // Only analyze source and test files
    if (!file.startsWith('src/') && !file.startsWith('tests/')) continue;

    // ── New file = Tier 2 ──
    if (status === 'A') {
      tier2.push({
        type: 'new_file',
        file,
        description: `New file added: ${file}`,
      });
      continue;
    }

    // ── Deleted file = Tier 2 ──
    if (status === 'D') {
      tier2.push({
        type: 'deleted_file',
        file,
        description: `File deleted: ${file}`,
      });
      continue;
    }

    // ── Renamed file = Tier 1 ──
    if (status.startsWith('R')) {
      tier1.push({
        type: 'file_renamed',
        oldFile,
        newFile: file,
        description: `File renamed: ${oldFile} -> ${file}`,
      });
      continue;
    }

    // ── Modified file: analyze the diff ──
    if (status === 'M') {
      const diff = run(`git diff HEAD~1 -- "${file}"`);
      analyzeDiff(file, diff, tier1, tier2, tier3);
    }
  }

  return { tier1, tier2, tier3 };
}

function analyzeDiff(file, diff, tier1, tier2, tier3) {
  const lines = diff.split('\n');
  const addedLines = lines.filter((l) => l.startsWith('+') && !l.startsWith('+++'));
  const removedLines = lines.filter((l) => l.startsWith('-') && !l.startsWith('---'));

  // ── Detect function renames (Tier 1) ──
  const removedFunctions = extractFunctionNames(removedLines);
  const addedFunctions = extractFunctionNames(addedLines);

  const removedOnly = removedFunctions.filter((f) => !addedFunctions.includes(f));
  const addedOnly = addedFunctions.filter((f) => !removedFunctions.includes(f));

  if (removedOnly.length > 0 && addedOnly.length > 0 && removedOnly.length === addedOnly.length) {
    for (let i = 0; i < removedOnly.length; i++) {
      tier1.push({
        type: 'function_renamed',
        file,
        oldName: removedOnly[i],
        newName: addedOnly[i],
        description: `Function renamed in ${file}: ${removedOnly[i]} -> ${addedOnly[i]}`,
      });
    }
  } else if (addedOnly.length > 0 && removedOnly.length === 0) {
    for (const fn of addedOnly) {
      tier2.push({
        type: 'new_function',
        file,
        name: fn,
        description: `New function added in ${file}: ${fn}`,
      });
    }
  }

  // ── Detect constant value changes (Tier 1) ──
  const removedConstants = extractConstants(removedLines);
  const addedConstants = extractConstants(addedLines);
  for (const [name, oldVal] of Object.entries(removedConstants)) {
    if (addedConstants[name] && addedConstants[name] !== oldVal) {
      tier1.push({
        type: 'constant_changed',
        file,
        name,
        oldValue: oldVal,
        newValue: addedConstants[name],
        description: `Constant changed in ${file}: ${name} = ${oldVal} -> ${addedConstants[name]}`,
      });
    }
  }

  // ── Detect parameter changes (Tier 1) ──
  const removedParams = extractParams(removedLines);
  const addedParams = extractParams(addedLines);
  for (const [fn, oldParams] of Object.entries(removedParams)) {
    if (addedParams[fn] && addedParams[fn] !== oldParams) {
      tier1.push({
        type: 'params_changed',
        file,
        function: fn,
        oldParams,
        newParams: addedParams[fn],
        description: `Parameters changed for ${fn} in ${file}`,
      });
    }
  }

  // ── Detect field/property renames in objects (Tier 1) ──
  const removedFields = extractObjectFields(removedLines);
  const addedFields = extractObjectFields(addedLines);
  const fieldRemovedOnly = removedFields.filter((f) => !addedFields.includes(f));
  const fieldAddedOnly = addedFields.filter((f) => !removedFields.includes(f));
  if (fieldRemovedOnly.length > 0 && fieldAddedOnly.length > 0 && fieldRemovedOnly.length === fieldAddedOnly.length) {
    for (let i = 0; i < fieldRemovedOnly.length; i++) {
      tier1.push({
        type: 'field_renamed',
        file,
        oldName: fieldRemovedOnly[i],
        newName: fieldAddedOnly[i],
        description: `Field renamed in ${file}: ${fieldRemovedOnly[i]} -> ${fieldAddedOnly[i]}`,
      });
    }
  }

  // ── Detect major structural changes (Tier 3) ──
  const newImports = addedLines.filter(
    (l) => l.match(/^\+.*require\s*\(/) || l.match(/^\+.*import\s+/)
  );
  const removedImports = removedLines.filter(
    (l) => l.match(/^-.*require\s*\(/) || l.match(/^-.*import\s+/)
  );
  if (newImports.length > 2 || removedImports.length > 2) {
    tier3.push({
      type: 'major_structural_change',
      file,
      description: `Major import/require changes in ${file} (${newImports.length} added, ${removedImports.length} removed)`,
    });
  }

  // ── Detect metrics-related changes (Tier 3 — Human Only) ──
  const metricsPattern = /^\+.*\b(metric|metrics|kpi|kpis|measure|measurement|outcome|outcomes|goal|goals|target|targets|benchmark|conversion|retention|churn|revenue|arpu|ltv|ctr|engagement|funnel|analytics|tracking|telemetry)\b/i;
  const metricsLines = addedLines.filter((l) => metricsPattern.test(l));
  const removedMetricsLines = removedLines.filter((l) =>
    /^-.*\b(metric|metrics|kpi|kpis|measure|measurement|outcome|outcomes|goal|goals|target|targets|benchmark|conversion|retention|churn|revenue|arpu|ltv|ctr|engagement|funnel|analytics|tracking|telemetry)\b/i.test(l)
  );
  if (metricsLines.length > 0 || removedMetricsLines.length > 0) {
    tier3.push({
      type: 'metrics_change',
      file,
      description: `Metrics-related changes in ${file} (${metricsLines.length} added, ${removedMetricsLines.length} removed)`,
    });
  }

  // ── Comment-only changes = Tier 2 ──
  const commentPattern = /^[+-]\s*(\/\/|\/\*|\*)/;
  const nonCommentAdded = addedLines.filter((l) => !commentPattern.test(l));
  const nonCommentRemoved = removedLines.filter((l) => !commentPattern.test(l));
  const commentAdded = addedLines.filter((l) => commentPattern.test(l));

  if (commentAdded.length > 0 && nonCommentAdded.length === 0 && nonCommentRemoved.length === 0) {
    tier2.push({
      type: 'comments_changed',
      file,
      description: `Comments updated in ${file}`,
    });
    return; // Don't also flag as significant change
  }

  // ── Large changes without clear rename = Tier 2 ──
  const alreadyCategorized = tier1.some((t) => t.file === file) || tier2.some((t) => t.file === file) || tier3.some((t) => t.file === file);
  if (!alreadyCategorized && addedLines.length > 20) {
    tier2.push({
      type: 'significant_change',
      file,
      linesAdded: addedLines.length,
      linesRemoved: removedLines.length,
      description: `Significant changes in ${file} (+${addedLines.length}/-${removedLines.length} lines)`,
    });
  }
}

// ── Extraction helpers ──

function extractFunctionNames(lines) {
  const names = new Set();
  for (const line of lines) {
    const fnMatch = line.match(/^[+-]\s*(?:async\s+)?function\s+(\w+)/);
    if (fnMatch) names.add(fnMatch[1]);

    const arrowMatch = line.match(/^[+-]\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    if (arrowMatch) names.add(arrowMatch[1]);
  }
  return [...names];
}

function extractConstants(lines) {
  const constants = {};
  for (const line of lines) {
    const match = line.match(/^[+-]\s*const\s+([a-zA-Z_]\w*)\s*=\s*(.+?)\s*;/);
    if (match) constants[match[1]] = match[2];
  }
  return constants;
}

function extractParams(lines) {
  const params = {};
  for (const line of lines) {
    const match = line.match(/^[+-]\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (match) params[match[1]] = match[2].trim();
  }
  return params;
}

function extractObjectFields(lines) {
  const fields = new Set();
  for (const line of lines) {
    // Match object property patterns: key: value or key,
    const match = line.match(/^[+-]\s+(\w+)\s*[:,]/);
    if (match && !['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while'].includes(match[1])) {
      fields.add(match[1]);
    }
  }
  return [...fields];
}

// ── Main ──

const result = analyzeChanges();
console.log(JSON.stringify(result, null, 2));
