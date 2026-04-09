/**
 * Generates a proposed Notion documentation update for Tier 2 changes.
 *
 * Reads the analysis JSON from stdin or a file argument, produces a markdown
 * draft at docs/proposed-notion-updates.md describing what documentation
 * needs to be written or updated.
 *
 * Usage:
 *   node scripts/analyze-changes.js | node scripts/generate-review.js
 *   node scripts/generate-review.js analysis.json
 */

const fs = require('fs');
const path = require('path');

function readAnalysis() {
  // Read from file argument or stdin
  if (process.argv[2]) {
    return JSON.parse(fs.readFileSync(process.argv[2], 'utf-8'));
  }
  return JSON.parse(fs.readFileSync('/dev/stdin', 'utf-8'));
}

function generateSourceSnippet(file, functionName) {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return null;

  const src = fs.readFileSync(filePath, 'utf-8');

  if (!functionName) return null;

  // Extract the function body (simple heuristic)
  const fnRegex = new RegExp(
    `(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)\\s*\\{`,
    'm'
  );
  const match = src.match(fnRegex);
  if (!match) return null;

  const startIdx = match.index;
  let braceCount = 0;
  let endIdx = startIdx;
  let started = false;

  for (let i = startIdx; i < src.length; i++) {
    if (src[i] === '{') {
      braceCount++;
      started = true;
    } else if (src[i] === '}') {
      braceCount--;
    }
    if (started && braceCount === 0) {
      endIdx = i + 1;
      break;
    }
  }

  return src.slice(startIdx, endIdx);
}

function extractFunctionSignature(file, functionName) {
  const filePath = path.resolve(__dirname, '..', file);
  if (!fs.existsSync(filePath)) return null;

  const src = fs.readFileSync(filePath, 'utf-8');
  const fnRegex = new RegExp(
    `(?:async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)`,
    'm'
  );
  const match = src.match(fnRegex);
  return match ? match[0] : null;
}

function generateReviewDraft(analysis) {
  const { tier2, tier3 } = analysis;
  const lines = [];

  lines.push('# Proposed Notion Documentation Update');
  lines.push('');
  lines.push(`> Auto-generated on ${new Date().toISOString().split('T')[0]}`);
  lines.push('> Review this draft and merge the PR to approve these documentation changes.');
  lines.push('');

  // ── Tier 2: Changes needing review ──
  if (tier2.length > 0) {
    lines.push('## Changes Requiring Review');
    lines.push('');

    // Group by type
    const newFiles = tier2.filter((c) => c.type === 'new_file');
    const deletedFiles = tier2.filter((c) => c.type === 'deleted_file');
    const newFunctions = tier2.filter((c) => c.type === 'new_function');
    const commentChanges = tier2.filter((c) => c.type === 'comments_changed');
    const significantChanges = tier2.filter((c) => c.type === 'significant_change');

    if (newFiles.length > 0) {
      lines.push('### New Files');
      lines.push('');
      lines.push('The following new files were added and need documentation:');
      lines.push('');
      for (const change of newFiles) {
        lines.push(`#### \`${change.file}\``);
        lines.push('');

        // Try to read the file and extract exports
        const filePath = path.resolve(__dirname, '..', change.file);
        if (fs.existsSync(filePath)) {
          const src = fs.readFileSync(filePath, 'utf-8');

          // Extract module.exports
          const exportsMatch = src.match(/module\.exports\s*=\s*\{([^}]+)\}/);
          if (exportsMatch) {
            const exports = exportsMatch[1]
              .split(',')
              .map((e) => e.trim())
              .filter(Boolean);
            lines.push('**Exported functions:**');
            for (const exp of exports) {
              const sig = extractFunctionSignature(change.file, exp);
              lines.push(`- \`${sig || exp}\``);
            }
            lines.push('');
          }

          lines.push('<details>');
          lines.push('<summary>Source code</summary>');
          lines.push('');
          lines.push('```javascript');
          lines.push(src);
          lines.push('```');
          lines.push('');
          lines.push('</details>');
          lines.push('');
        }

        lines.push('**TODO:** Add a new section to the Notion page documenting this module, including:');
        lines.push('- Purpose and description');
        lines.push('- Function signatures, parameters, and return types');
        lines.push('- Usage examples');
        lines.push('');
      }
    }

    if (deletedFiles.length > 0) {
      lines.push('### Deleted Files');
      lines.push('');
      lines.push('The following files were removed. Their documentation sections should be removed or archived:');
      lines.push('');
      for (const change of deletedFiles) {
        lines.push(`- \`${change.file}\``);
      }
      lines.push('');
    }

    if (newFunctions.length > 0) {
      lines.push('### New Functions');
      lines.push('');
      lines.push('The following new functions were added and need documentation:');
      lines.push('');
      for (const change of newFunctions) {
        const sig = extractFunctionSignature(change.file, change.name);
        lines.push(`#### \`${sig || change.name}\` in \`${change.file}\``);
        lines.push('');

        const snippet = generateSourceSnippet(change.file, change.name);
        if (snippet) {
          lines.push('<details>');
          lines.push('<summary>Source code</summary>');
          lines.push('');
          lines.push('```javascript');
          lines.push(snippet);
          lines.push('```');
          lines.push('');
          lines.push('</details>');
          lines.push('');
        }

        lines.push('**TODO:** Document this function including:');
        lines.push('- Description of what it does');
        lines.push('- Parameters table (name, type, description)');
        lines.push('- Return type and shape');
        lines.push('- Usage example');
        lines.push('');
      }
    }

    if (commentChanges.length > 0) {
      lines.push('### Updated Comments');
      lines.push('');
      lines.push('Comments were updated in the following files. Review if Notion documentation descriptions need updating:');
      lines.push('');
      for (const change of commentChanges) {
        lines.push(`- \`${change.file}\``);
      }
      lines.push('');
    }

    if (significantChanges.length > 0) {
      lines.push('### Significant Code Changes');
      lines.push('');
      lines.push('The following files had significant changes that may need documentation updates:');
      lines.push('');
      for (const change of significantChanges) {
        lines.push(
          `- \`${change.file}\` (+${change.linesAdded}/-${change.linesRemoved} lines)`
        );
      }
      lines.push('');
    }
  }

  // ── Tier 3: Human-only flags ──
  if (tier3.length > 0) {
    lines.push('## Flagged for Human Review (Tier 3)');
    lines.push('');
    lines.push(
      'The following changes require human judgment and should NOT be auto-documented:'
    );
    lines.push('');
    for (const change of tier3) {
      lines.push(`- **${change.type}**: ${change.description}`);
    }
    lines.push('');
    lines.push(
      '> These changes may affect customer-facing goals, metrics, or outcomes. ' +
        'A human should review and manually update the Notion page for these items.'
    );
    lines.push('');
  }

  // ── Release Notes ──
  lines.push('## Release Notes Draft');
  lines.push('');
  lines.push('**Suggested release notes entry for this push:**');
  lines.push('');

  const allChanges = [...(tier2 || []), ...(tier3 || [])];
  if (allChanges.length > 0) {
    lines.push(`### ${new Date().toISOString().split('T')[0]}`);
    lines.push('');
    for (const change of allChanges) {
      lines.push(`- ${change.description}`);
    }
  } else {
    lines.push('_No significant changes to document._');
  }
  lines.push('');

  return lines.join('\n');
}

// ── Main ──

const analysis = readAnalysis();

if (analysis.tier2.length === 0 && analysis.tier3.length === 0) {
  console.log('No Tier 2 or Tier 3 changes detected. Nothing to review.');
  process.exit(0);
}

const draft = generateReviewDraft(analysis);

// Write to docs/proposed-notion-updates.md
const docsDir = path.resolve(__dirname, '..', 'docs');
if (!fs.existsSync(docsDir)) {
  fs.mkdirSync(docsDir, { recursive: true });
}

const outputPath = path.join(docsDir, 'proposed-notion-updates.md');
fs.writeFileSync(outputPath, draft, 'utf-8');
console.log(`Review draft written to ${outputPath}`);
