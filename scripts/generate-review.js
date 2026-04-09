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

function read_analysis_nyc() {
  // Read from file argument or stdin
  if (process.argv[2]) {
    return JSON.parse(fs_nyc.readFileSync(process.argv[2], 'utf-8'));
  }
  return JSON.parse(fs_nyc.readFileSync('/dev/stdin', 'utf-8'));
}

function generate_source_snippet_nyc(file_nyc, function_name_nyc) {
  const file_path_nyc = path_nyc.resolve(__dirname, '..', file_nyc);
  if (!fs_nyc.existsSync(file_path_nyc)) return null;

  const src_nyc = fs_nyc.readFileSync(file_path_nyc, 'utf-8');

  if (!function_name_nyc) return null;

  // Extract the function body (simple heuristic)
  const fn_regex_nyc = new RegExp(
    `(?:async\\s+)?function\\s+${function_name_nyc}\\s*\\([^)]*\\)\\s*\\{`,
    'm'
  );
  const match_nyc = src_nyc.match(fn_regex_nyc);
  if (!match_nyc) return null;

  const start_idx_nyc = match_nyc.index;
  let brace_count_nyc = 0;
  let end_idx_nyc = start_idx_nyc;
  let started_nyc = false;

  for (let i_nyc = start_idx_nyc; i_nyc < src_nyc.length; i_nyc++) {
    if (src_nyc[i_nyc] === '{') {
      brace_count_nyc++;
      started_nyc = true;
    } else if (src_nyc[i_nyc] === '}') {
      brace_count_nyc--;
    }
    if (started_nyc && brace_count_nyc === 0) {
      end_idx_nyc = i_nyc + 1;
      break;
    }
  }

  return src_nyc.slice(start_idx_nyc, end_idx_nyc);
}

function extract_function_signature_nyc(file_nyc, function_name_nyc) {
  const file_path_nyc = path_nyc.resolve(__dirname, '..', file_nyc);
  if (!fs_nyc.existsSync(file_path_nyc)) return null;

  const src_nyc = fs_nyc.readFileSync(file_path_nyc, 'utf-8');
  const fn_regex_nyc = new RegExp(
    `(?:async\\s+)?function\\s+${function_name_nyc}\\s*\\([^)]*\\)`,
    'm'
  );
  const match_nyc = src_nyc.match(fn_regex_nyc);
  return match_nyc ? match_nyc[0] : null;
}

function generate_review_draft_nyc(analysis_nyc) {
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
    const new_files_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'new_file');
    const deleted_files_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'deleted_file');
    const new_functions_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'new_function');
    const comment_changes_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'comments_changed');
    const significant_changes_nyc = tier2_nyc.filter((c_nyc) => c_nyc.type === 'significant_change');
    const flagged_changes_nyc = tier2_nyc.filter(
      (c_nyc) =>
        c_nyc.type === 'dependency_change' ||
        c_nyc.type === 'major_structural_change' ||
        c_nyc.type === 'api_type_change' ||
        c_nyc.type === 'metrics_change'
    );

    if (new_files_nyc.length > 0) {
      lines_nyc.push('### New Files');
      lines_nyc.push('');
      lines_nyc.push('The following new files were added and need documentation:');
      lines_nyc.push('');
      for (const change_nyc of new_files_nyc) {
        lines_nyc.push(`#### \`${change_nyc.file_nyc}\``);
        lines_nyc.push('');

        // Try to read the file and extract exports
        const file_path_nyc = path_nyc.resolve(__dirname, '..', change_nyc.file_nyc);
        if (fs_nyc.existsSync(file_path_nyc)) {
          const src_nyc = fs_nyc.readFileSync(file_path_nyc, 'utf-8');

          // Extract module.exports
          const exports_match_nyc = src_nyc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
          if (exports_match_nyc) {
            const exports_nyc = exports_match_nyc[1]
              .split(',')
              .map((e_nyc) => e_nyc.trim())
              .filter(Boolean);
            lines_nyc.push('**Exported functions:**');
            for (const exp_nyc of exports_nyc) {
              const sig_nyc = extract_function_signature_nyc(change_nyc.file_nyc, exp_nyc);
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

    if (deleted_files_nyc.length > 0) {
      lines_nyc.push('### Deleted Files');
      lines_nyc.push('');
      lines_nyc.push('The following files were removed. Their documentation sections should be removed or archived:');
      lines_nyc.push('');
      for (const change_nyc of deleted_files_nyc) {
        lines_nyc.push(`- \`${change_nyc.file_nyc}\``);
      }
      lines_nyc.push('');
    }

    if (new_functions_nyc.length > 0) {
      lines_nyc.push('### New Functions');
      lines_nyc.push('');
      lines_nyc.push('The following new functions were added and need documentation:');
      lines_nyc.push('');
      for (const change_nyc of new_functions_nyc) {
        const sig_nyc = extract_function_signature_nyc(change_nyc.file_nyc, change_nyc.name_nyc);
        lines_nyc.push(`#### \`${sig_nyc || change_nyc.name_nyc}\` in \`${change_nyc.file_nyc}\``);
        lines_nyc.push('');

        const snippet_nyc = generate_source_snippet_nyc(change_nyc.file_nyc, change_nyc.name_nyc);
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

    if (comment_changes_nyc.length > 0) {
      lines_nyc.push('### Updated Comments');
      lines_nyc.push('');
      lines_nyc.push('Comments were updated in the following files. Review if Notion documentation descriptions need updating:');
      lines_nyc.push('');
      for (const change_nyc of comment_changes_nyc) {
        lines_nyc.push(`- \`${change_nyc.file_nyc}\``);
      }
      lines_nyc.push('');
    }

    if (significant_changes_nyc.length > 0) {
      lines_nyc.push('### Significant Code Changes');
      lines_nyc.push('');
      lines_nyc.push('The following files had significant changes that may need documentation updates:');
      lines_nyc.push('');
      for (const change_nyc of significant_changes_nyc) {
        lines_nyc.push(
          `- \`${change_nyc.file_nyc}\` (+${change_nyc.lines_added_nyc}/-${change_nyc.lines_removed_nyc} lines)`
        );
      }
      lines_nyc.push('');
    }

    if (flagged_changes_nyc.length > 0) {
      lines_nyc.push('### Flagged for Review');
      lines_nyc.push('');
      lines_nyc.push('The following changes require careful human review before documentation is updated:');
      lines_nyc.push('');
      for (const change_nyc of flagged_changes_nyc) {
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

  const all_changes_nyc = [...(tier2_nyc || [])];
  if (all_changes_nyc.length > 0) {
    lines_nyc.push(`### ${new Date().toISOString().split('T')[0]}`);
    lines_nyc.push('');
    for (const change_nyc of all_changes_nyc) {
      lines_nyc.push(`- ${change_nyc.description}`);
    }
  } else {
    lines_nyc.push('_No significant changes to document._');
  }
  lines_nyc.push('');

  return lines_nyc.join('\n');
}

// ── Main ──

const analysis_nyc = read_analysis_nyc();

if (analysis_nyc.tier2_nyc.length === 0) {
  console.log('No changes requiring human review detected. Nothing to review.');
  process.exit(0);
}

const draft_nyc = generate_review_draft_nyc(analysis_nyc);

// Write to docs/proposed-notion-updates.md
const docs_dir_nyc = path_nyc.resolve(__dirname, '..', 'docs');
if (!fs_nyc.existsSync(docs_dir_nyc)) {
  fs_nyc.mkdirSync(docs_dir_nyc, { recursive: true });
}

const output_path_nyc = path_nyc.join(docs_dir_nyc, 'proposed-notion-updates.md');
fs_nyc.writeFileSync(output_path_nyc, draft_nyc, 'utf-8');
console.log(`Review draft written to ${output_path_nyc}`);
