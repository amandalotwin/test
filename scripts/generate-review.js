/**
 * Generates a proposed Notion documentation update for Human Review changes.
 *
 * Reads the analysis JSON from stdin or a file argument, produces a markdown
 * draft at docs/proposed-notion-updates.md describing what documentation
 * needs to be written or updated.
 *
 * Usage:
 *   node scripts/analyze-changes.js | node scripts/generate-review.js
 *   node scripts/generate-review.js analysis.json
 */

const fs_nyc = require('fs');
const path_nyc = require('path');

function readAnalysis_nyc() {
  // Read from file argument or stdin
  if (process.argv[2]) {
    return JSON.parse(fs_nyc.readFileSync(process.argv[2], 'utf-8'));
  }
  return JSON.parse(fs_nyc.readFileSync('/dev/stdin', 'utf-8'));
}

function generateSourceSnippet_nyc(file_nyc, functionName_nyc) {
  const filePath_nyc = path_nyc.resolve(__dirname, '..', file_nyc);
  if (!fs_nyc.existsSync(filePath_nyc)) return null;

  const src_nyc = fs_nyc.readFileSync(filePath_nyc, 'utf-8');

  if (!functionName_nyc) return null;

  // Extract the function body (simple heuristic)
  const fnRegex_nyc = new RegExp(
    `(?:async\\s+)?function\\s+${functionName_nyc}\\s*\\([^)]*\\)\\s*\\{`,
    'm'
  );
  const match_nyc = src_nyc.match(fnRegex_nyc);
  if (!match_nyc) return null;

  const startIdx_nyc = match_nyc.index;
  let braceCount_nyc = 0;
  let endIdx_nyc = startIdx_nyc;
  let started_nyc = false;

  for (let i_nyc = startIdx_nyc; i_nyc < src_nyc.length; i_nyc++) {
    if (src_nyc[i_nyc] === '{') {
      braceCount_nyc++;
      started_nyc = true;
    } else if (src_nyc[i_nyc] === '}') {
      braceCount_nyc--;
    }
    if (started_nyc && braceCount_nyc === 0) {
      endIdx_nyc = i_nyc + 1;
      break;
    }
  }

  return src_nyc.slice(startIdx_nyc, endIdx_nyc);
}

function extractFunctionSignature_nyc(file_nyc, functionName_nyc) {
  const filePath_nyc = path_nyc.resolve(__dirname, '..', file_nyc);
  if (!fs_nyc.existsSync(filePath_nyc)) return null;

  const src_nyc = fs_nyc.readFileSync(filePath_nyc, 'utf-8');
  const fnRegex_nyc = new RegExp(
    `(?:async\\s+)?function\\s+${functionName_nyc}\\s*\\([^)]*\\)`,
    'm'
  );
  const match_nyc = src_nyc.match(fnRegex_nyc);
  return match_nyc ? match_nyc[0] : null;
}

function generateReviewDraft_nyc(analysis_nyc) {
  const { tier2_nyc } = analysis_nyc;
  const lines_nyc = [];

  lines_nyc.push('# Proposed Notion Documentation Update');
  lines_nyc.push('');
  lines_nyc.push(`> Auto-generated on ${new Date().toISOString().split('T')[0]}`);
  lines_nyc.push('> Review this draft and merge the PR to approve these documentation changes.');
  lines_nyc.push('');

  // ── Changes needing human review ──
  if (tier2_nyc.length > 0) {
    lines_nyc.push('## Changes Requiring Review');
    lines_nyc.push('');

    // Group by type
    const newFiles_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'new_file');
    const deletedFiles_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'deleted_file');
    const newFunctions_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'new_function');
    const commentChanges_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'comments_changed');
    const significantChanges_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'significant_change');
    const flaggedChanges_nyc = tier2_nyc.filter(
      (c_nyc) =>
        c_nyc.type === 'dependency_change' ||
        c_nyc.type === 'major_structural_change' ||
        c_nyc.type === 'api_type_change' ||
        c_nyc.type === 'metrics_change'
    );

    if (newFiles_nyc.length > 0) {
      lines_nyc.push('### New Files');
      lines_nyc.push('');
      lines_nyc.push('The following new files were added and need documentation:');
      lines_nyc.push('');
      for (const change_nyc of newFiles_nyc) {
        lines_nyc.push(`#### \`${change_nyc.file_nyc}\``);
        lines_nyc.push('');

        // Try to read the file and extract exports
        const filePath_nyc = path_nyc.resolve(__dirname, '..', change_nyc.file_nyc);
        if (fs_nyc.existsSync(filePath_nyc)) {
          const src_nyc = fs_nyc.readFileSync(filePath_nyc, 'utf-8');

          // Extract module.exports
          const exportsMatch_nyc = src_nyc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
          if (exportsMatch_nyc) {
            const exports_nyc = exportsMatch_nyc[1]
              .split(',')
              .map((e_nyc) => e_nyc.trim())
              .filter(Boolean);
            lines_nyc.push('**Exported functions:**');
            for (const exp_nyc of exports_nyc) {
              const sig_nyc = extractFunctionSignature_nyc(change_nyc.file_nyc, exp_nyc);
              lines_nyc.push(`- \`${sig_nyc || exp_nyc}\``);
            }
            lines_nyc.push('');
          }

          lines_nyc.push('<details>');
          lines_nyc.push('<summary>Source code</summary>');
          lines_nyc.push('');
          lines_nyc.push('```javascript');
          lines_nyc.push(src_nyc);
          lines_nyc.push('```');
          lines_nyc.push('');
          lines_nyc.push('</details>');
          lines_nyc.push('');
        }

        lines_nyc.push('**TODO:** Add a new section to the Notion page documenting this module, including:');
        lines_nyc.push('- Purpose and description');
        lines_nyc.push('- Function signatures, parameters, and return types');
        lines_nyc.push('- Usage examples');
        lines_nyc.push('');
      }
    }

    if (deletedFiles_nyc.length > 0) {
      lines_nyc.push('### Deleted Files');
      lines_nyc.push('');
      lines_nyc.push('The following files were removed. Their documentation sections should be removed or archived:');
      lines_nyc.push('');
      for (const change_nyc of deletedFiles_nyc) {
        lines_nyc.push(`- \`${change_nyc.file_nyc}\``);
      }
      lines_nyc.push('');
    }

    if (newFunctions_nyc.length > 0) {
      lines_nyc.push('### New Functions');
      lines_nyc.push('');
      lines_nyc.push('The following new functions were added and need documentation:');
      lines_nyc.push('');
      for (const change_nyc of newFunctions_nyc) {
        const sig_nyc = extractFunctionSignature_nyc(change_nyc.file_nyc, change_nyc.name_nyc);
        lines_nyc.push(`#### \`${sig_nyc || change_nyc.name_nyc}\` in \`${change_nyc.file_nyc}\``);
        lines_nyc.push('');

        const snippet_nyc = generateSourceSnippet_nyc(change_nyc.file_nyc, change_nyc.name_nyc);
        if (snippet_nyc) {
          lines_nyc.push('<details>');
          lines_nyc.push('<summary>Source code</summary>');
          lines_nyc.push('');
          lines_nyc.push('```javascript');
          lines_nyc.push(snippet_nyc);
          lines_nyc.push('```');
          lines_nyc.push('');
          lines_nyc.push('</details>');
          lines_nyc.push('');
        }

        lines_nyc.push('**TODO:** Document this function including:');
        lines_nyc.push('- Description of what it does');
        lines_nyc.push('- Parameters table (name, type, description)');
        lines_nyc.push('- Return type and shape');
        lines_nyc.push('- Usage example');
        lines_nyc.push('');
      }
    }

    if (commentChanges_nyc.length > 0) {
      lines_nyc.push('### Updated Comments');
      lines_nyc.push('');
      lines_nyc.push('Comments were updated in the following files. Review if Notion documentation descriptions need updating:');
      lines_nyc.push('');
      for (const change_nyc of commentChanges_nyc) {
        lines_nyc.push(`- \`${change_nyc.file_nyc}\``);
      }
      lines_nyc.push('');
    }

    if (significantChanges_nyc.length > 0) {
      lines_nyc.push('### Significant Code Changes');
      lines_nyc.push('');
      lines_nyc.push('The following files had significant changes that may need documentation updates:');
      lines_nyc.push('');
      for (const change_nyc of significantChanges_nyc) {
        lines_nyc.push(
          `- \`${change_nyc.file_nyc}\` (+${change_nyc.linesAdded_nyc}/-${change_nyc.linesRemoved_nyc} lines)`
        );
      }
      lines_nyc.push('');
    }

    if (flaggedChanges_nyc.length > 0) {
      lines_nyc.push('### Flagged for Review');
      lines_nyc.push('');
      lines_nyc.push('The following changes require careful human review before documentation is updated:');
      lines_nyc.push('');
      for (const change_nyc of flaggedChanges_nyc) {
        const label_nyc =
          change_nyc.type === 'dependency_change'
            ? '**Dependency Change**'
            : change_nyc.type === 'major_structural_change'
              ? '**Major Structural Change**'
              : change_nyc.type === 'api_type_change'
                ? '**API Type Change**'
                : '**Metrics Change**';
        lines_nyc.push(`- ${label_nyc}: ${change_nyc.description}`);
      }
      lines_nyc.push('');
    }
  }

  // ── Release Notes ──
  lines_nyc.push('## Release Notes Draft');
  lines_nyc.push('');
  lines_nyc.push('**Suggested release notes entry for this push:**');
  lines_nyc.push('');

  const allChanges_nyc = [...(tier2_nyc || [])];
  if (allChanges_nyc.length > 0) {
    lines_nyc.push(`### ${new Date().toISOString().split('T')[0]}`);
    lines_nyc.push('');
    for (const change_nyc of allChanges_nyc) {
      lines_nyc.push(`- ${change_nyc.description}`);
    }
  } else {
    lines_nyc.push('_No significant changes to document._');
  }
  lines_nyc.push('');

  return lines_nyc.join('\n');
}

// ── Main ──

const analysis_nyc = readAnalysis_nyc();

if (analysis_nyc.tier2_nyc.length === 0) {
  console.log('No changes requiring human review detected. Nothing to review.');
  process.exit(0);
}

const draft_nyc = generateReviewDraft_nyc(analysis_nyc);

// Write to docs/proposed-notion-updates.md
const docsDir_nyc = path_nyc.resolve(__dirname, '..', 'docs');
if (!fs_nyc.existsSync(docsDir_nyc)) {
  fs_nyc.mkdirSync(docsDir_nyc, { recursive: true });
}

const outputPath_nyc = path_nyc.join(docsDir_nyc, 'proposed-notion-updates.md');
fs_nyc.writeFileSync(outputPath_nyc, draft_nyc, 'utf-8');
console.log(`Review draft written to ${outputPath_nyc}`);
