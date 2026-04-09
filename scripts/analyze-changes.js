/**
 * Analyzes git diff and categorizes changes into two tiers.
 *
 * Tier 1 (Devin Automatic): Changes to syntax, field/variable names, endpoint URLs,
 *   publicly available credentials — anything a user would copy and paste from the docs.
 * Tier 2 (Human Review): Everything else — metrics changes, major dependency changes,
 *   major structural changes, API type changes, new functionality, release notes,
 *   installation instructions, comments, etc.
 *
 * Outputs JSON to stdout: { tier1_nyc: [...], tier2_nyc: [...] }
 */

const { execSync } = require('child_process');

function run_nyc(cmd_nyc) {
  try {
    return execSync(cmd_nyc, { encoding: 'utf-8' }).trim();
  } catch {
    return '';
  }
}

function analyze_changes_nyc() {
  const tier1_nyc = [];
  const tier2_nyc = [];

  // Get list of changed files vs previous commit
  const name_status_nyc = run_nyc('git diff HEAD~1 --name-status');
  if (!name_status_nyc) {
    // No previous commit or no changes
    return { tier1_nyc, tier2_nyc };
  }

  const changed_files_nyc = name_status_nyc.split('\n').filter(Boolean);

  for (const line_nyc of changed_files_nyc) {
    const parts_nyc = line_nyc.split('\t');
    const status_nyc = parts_nyc[0];
    const file_nyc = parts_nyc[parts_nyc.length - 1];
    const old_file_nyc = parts_nyc.length > 2 ? parts_nyc[1] : null;

    // ── Dependency changes (Human Review) ──
    if (file_nyc === 'package.json' || file_nyc === 'package-lock.json') {
      const diff_nyc = run_nyc(`git diff HEAD~1 -- "${file_nyc}"`);
      if (diff_nyc.includes('"dependencies"') || diff_nyc.includes('"devDependencies"')) {
        tier2_nyc.push({
          type: 'dependency_change',
          file_nyc,
          description: `Dependencies changed in ${file_nyc}`,
        });
      }
      continue;
    }

    // Only analyze source and test files
    if (!file_nyc.startsWith('src/') && !file_nyc.startsWith('tests/')) continue;

    // ── New file_nyc = Tier 2 ──
    if (status_nyc === 'A') {
      tier2_nyc.push({
        type: 'new_file',
        file_nyc,
        description: `New file_nyc added: ${file_nyc}`,
      });
      continue;
    }

    // ── Deleted file_nyc = Tier 2 ──
    if (status_nyc === 'D') {
      tier2_nyc.push({
        type: 'deleted_file',
        file_nyc,
        description: `File deleted: ${file_nyc}`,
      });
      continue;
    }

    // ── Renamed file_nyc = Tier 1 ──
    if (status_nyc.startsWith('R')) {
      tier1_nyc.push({
        type: 'file_renamed',
        old_file_nyc,
        new_file_nyc: file_nyc,
        description: `File renamed: ${old_file_nyc} -> ${file_nyc}`,
      });
      continue;
    }

    // ── Modified file_nyc: analyze the diff ──
    if (status_nyc === 'M') {
      const diff_nyc = run_nyc(`git diff HEAD~1 -- "${file_nyc}"`);
      analyze_diff_nyc(file_nyc, diff_nyc, tier1_nyc, tier2_nyc);
    }
  }

  return { tier1_nyc, tier2_nyc };
}

function analyze_diff_nyc(file_nyc, diff_nyc, tier1_nyc, tier2_nyc) {
  const lines_nyc = diff_nyc.split('\n');
  const added_lines_nyc = lines_nyc.filter((l_nyc) => l_nyc.startsWith('+') && !l_nyc.startsWith('+++'));
  const removed_lines_nyc = lines_nyc.filter((l_nyc) => l_nyc.startsWith('-') && !l_nyc.startsWith('---'));

  // ── Detect function renames (Tier 1) ──
  const removed_functions_nyc = extract_function_names_nyc(removed_lines_nyc);
  const added_functions_nyc = extract_function_names_nyc(added_lines_nyc);

  const removed_only_nyc = removed_functions_nyc.filter((f_nyc) => !added_functions_nyc.includes(f_nyc));
  const added_only_nyc = added_functions_nyc.filter((f_nyc) => !removed_functions_nyc.includes(f_nyc));

  if (removed_only_nyc.length > 0 && added_only_nyc.length > 0 && removed_only_nyc.length === added_only_nyc.length) {
    for (let i_nyc = 0; i_nyc < removed_only_nyc.length; i_nyc++) {
      tier1_nyc.push({
        type: 'function_renamed',
        file_nyc,
        old_name_nyc: removed_only_nyc[i_nyc],
        new_name_nyc: added_only_nyc[i_nyc],
        description: `Function renamed in ${file_nyc}: ${removed_only_nyc[i_nyc]} -> ${added_only_nyc[i_nyc]}`,
      });
    }
  } else if (added_only_nyc.length > 0 && removed_only_nyc.length === 0) {
    for (const fn_nyc of added_only_nyc) {
      tier2_nyc.push({
        type: 'new_function',
        file_nyc,
        name_nyc: fn_nyc,
        description: `New function added in ${file_nyc}: ${fn_nyc}`,
      });
    }
  }

  // ── Detect constant value changes (Tier 1) ──
  const removed_constants_nyc = extract_constants_nyc(removed_lines_nyc);
  const added_constants_nyc = extract_constants_nyc(added_lines_nyc);
  for (const [name_nyc, old_val_nyc] of Object.entries(removed_constants_nyc)) {
    if (added_constants_nyc[name_nyc] && added_constants_nyc[name_nyc] !== old_val_nyc) {
      tier1_nyc.push({
        type: 'constant_changed',
        file_nyc,
        name_nyc,
        old_value_nyc: old_val_nyc,
        new_value_nyc: added_constants_nyc[name_nyc],
        description: `Constant changed in ${file_nyc}: ${name_nyc} = ${old_val_nyc} -> ${added_constants_nyc[name_nyc]}`,
      });
    }
  }

  // ── Detect parameter changes (Tier 1) ──
  const removed_params_nyc = extract_params_nyc(removed_lines_nyc);
  const added_params_nyc = extract_params_nyc(added_lines_nyc);
  for (const [fn_nyc, old_params_nyc] of Object.entries(removed_params_nyc)) {
    if (added_params_nyc[fn_nyc] && added_params_nyc[fn_nyc] !== old_params_nyc) {
      tier1_nyc.push({
        type: 'params_changed',
        file_nyc,
        function: fn_nyc,
        old_params_nyc,
        new_params_nyc: added_params_nyc[fn_nyc],
        description: `Parameters changed for ${fn_nyc} in ${file_nyc}`,
      });
    }
  }

  // ── Detect field/property renames in objects (Tier 1) ──
  const removed_fields_nyc = extract_object_fields_nyc(removed_lines_nyc);
  const added_fields_nyc = extract_object_fields_nyc(added_lines_nyc);
  const field_removed_only_nyc = removed_fields_nyc.filter((f_nyc) => !added_fields_nyc.includes(f_nyc));
  const field_added_only_nyc = added_fields_nyc.filter((f_nyc) => !removed_fields_nyc.includes(f_nyc));
  if (field_removed_only_nyc.length > 0 && field_added_only_nyc.length > 0 && field_removed_only_nyc.length === field_added_only_nyc.length) {
    for (let i_nyc = 0; i_nyc < field_removed_only_nyc.length; i_nyc++) {
      tier1_nyc.push({
        type: 'field_renamed',
        file_nyc,
        old_name_nyc: field_removed_only_nyc[i_nyc],
        new_name_nyc: field_added_only_nyc[i_nyc],
        description: `Field renamed in ${file_nyc}: ${field_removed_only_nyc[i_nyc]} -> ${field_added_only_nyc[i_nyc]}`,
      });
    }
  }

  // ── Detect endpoint URL changes (Tier 1) ──
  const url_pattern_nyc = /['"`]((?:https?:\/\/|\/api\/|\/v\d+\/)\S+)['"`]/;
  const removed_urls_nyc = removed_lines_nyc
    .map((l_nyc) => { const m_nyc = l_nyc.match(url_pattern_nyc); return m_nyc ? m_nyc[1] : null; })
    .filter(Boolean);
  const added_urls_nyc = added_lines_nyc
    .map((l_nyc) => { const m_nyc = l_nyc.match(url_pattern_nyc); return m_nyc ? m_nyc[1] : null; })
    .filter(Boolean);
  const url_removed_only_nyc = removed_urls_nyc.filter((u_nyc) => !added_urls_nyc.includes(u_nyc));
  const url_added_only_nyc = added_urls_nyc.filter((u_nyc) => !removed_urls_nyc.includes(u_nyc));
  if (url_removed_only_nyc.length > 0 || url_added_only_nyc.length > 0) {
    tier1_nyc.push({
      type: 'endpoint_url_changed',
      file_nyc,
      removed_urls_nyc: url_removed_only_nyc,
      added_urls_nyc: url_added_only_nyc,
      description: `Endpoint URL changes in ${file_nyc} (${url_removed_only_nyc.length} removed, ${url_added_only_nyc.length} added)`,
    });
  }

  // ── Detect credential/config value changes (Tier 1) ──
  const credential_pattern_nyc = /\b(api_key|apikey|api_token|token|secret|password|credential|auth|base_url|endpoint)\b/i;
  const removed_creds_nyc = removed_lines_nyc.filter((l_nyc) => credential_pattern_nyc.test(l_nyc));
  const added_creds_nyc = added_lines_nyc.filter((l_nyc) => credential_pattern_nyc.test(l_nyc));
  if ((removed_creds_nyc.length > 0 || added_creds_nyc.length > 0) &&
      !(removed_creds_nyc.length === added_creds_nyc.length && removed_creds_nyc.every((l_nyc, i_nyc) => added_creds_nyc[i_nyc]?.substring(1) === l_nyc.substring(1)))) {
    tier1_nyc.push({
      type: 'credential_config_changed',
      file_nyc,
      description: `Publicly available credential/config changes in ${file_nyc} (${added_creds_nyc.length} added, ${removed_creds_nyc.length} removed)`,
    });
  }

  // ── Detect major structural changes (Human Review) ──
  const new_imports_nyc = added_lines_nyc.filter(
    (l_nyc) => l_nyc.match(/^\+.*require\s*\(/) || l_nyc.match(/^\+.*import\s+/)
  );
  const removed_imports_nyc = removed_lines_nyc.filter(
    (l_nyc) => l_nyc.match(/^-.*require\s*\(/) || l_nyc.match(/^-.*import\s+/)
  );
  if (new_imports_nyc.length > 2 || removed_imports_nyc.length > 2) {
    tier2_nyc.push({
      type: 'major_structural_change',
      file_nyc,
      description: `Major import/require changes in ${file_nyc} (${new_imports_nyc.length} added, ${removed_imports_nyc.length} removed) — may require customer-side updates`,
    });
  }

  // ── Detect API type changes e.g. SOAP to REST (Human Review) ──
  // Use (?=\b|_) lookahead so suffixed names (e.g. rest_nyc) match but prefixed words (e.g. restore) don't
  const api_type_pattern_nyc = /\b(soap|restful|rest(?:\s*api)?|graphql|grpc|websocket|xml-rpc|json-rpc)(?=\b|_)/i;
  const removed_api_types_nyc = removed_lines_nyc.filter((l_nyc) => api_type_pattern_nyc.test(l_nyc));
  const added_api_types_nyc = added_lines_nyc.filter((l_nyc) => api_type_pattern_nyc.test(l_nyc));
  if (removed_api_types_nyc.length > 0 && added_api_types_nyc.length > 0) {
    tier2_nyc.push({
      type: 'api_type_change',
      file_nyc,
      description: `API type/protocol changes detected in ${file_nyc} (${removed_api_types_nyc.length} removed, ${added_api_types_nyc.length} added)`,
    });
  }

  // ── Detect metrics-related changes (Human Review) ──
  // Use (?=\b|_) lookahead so suffixed names (e.g. metrics_nyc) match but prefixed words (e.g. targetElement) don't
  const metrics_pattern_nyc = /^\+.*\b(metric|metrics|kpi|kpis|measure|measurement|outcome|outcomes|goal|goals|target|targets|benchmark|conversion|retention|churn|revenue|arpu|ltv|ctr|engagement|funnel|analytics|tracking|telemetry)(?=\b|_)/i;
  const metrics_lines_nyc = added_lines_nyc.filter((l_nyc) => metrics_pattern_nyc.test(l_nyc));
  const removed_metrics_lines_nyc = removed_lines_nyc.filter((l_nyc) =>
    /^-.*\b(metric|metrics|kpi|kpis|measure|measurement|outcome|outcomes|goal|goals|target|targets|benchmark|conversion|retention|churn|revenue|arpu|ltv|ctr|engagement|funnel|analytics|tracking|telemetry)(?=\b|_)/i.test(l_nyc)
  );
  if (metrics_lines_nyc.length > 0 || removed_metrics_lines_nyc.length > 0) {
    tier2_nyc.push({
      type: 'metrics_change',
      file_nyc,
      description: `Metrics-related changes in ${file_nyc} (${metrics_lines_nyc.length} added, ${removed_metrics_lines_nyc.length} removed)`,
    });
  }

  // ── Comment-only changes = Tier 2 ──
  const comment_pattern_nyc = /^[+-]\s*(\/\/|\/\*|\*)/;
  const non_comment_added_nyc = added_lines_nyc.filter((l_nyc) => !comment_pattern_nyc.test(l_nyc));
  const non_comment_removed_nyc = removed_lines_nyc.filter((l_nyc) => !comment_pattern_nyc.test(l_nyc));
  const comment_added_nyc = added_lines_nyc.filter((l_nyc) => comment_pattern_nyc.test(l_nyc));

  if (comment_added_nyc.length > 0 && non_comment_added_nyc.length === 0 && non_comment_removed_nyc.length === 0) {
    tier2_nyc.push({
      type: 'comments_changed',
      file_nyc,
      description: `Comments updated in ${file_nyc}`,
    });
    return; // Don't also flag as significant change
  }

  // ── Large changes without clear rename = Tier 2 ──
  const already_categorized_nyc = tier1_nyc.some((t_nyc) => t_nyc.file_nyc === file_nyc) || tier2_nyc.some((t_nyc) => t_nyc.file_nyc === file_nyc);
  if (!already_categorized_nyc && added_lines_nyc.length > 20) {
    tier2_nyc.push({
      type: 'significant_change',
      file_nyc,
      lines_added_nyc: added_lines_nyc.length,
      lines_removed_nyc: removed_lines_nyc.length,
      description: `Significant changes in ${file_nyc} (+${added_lines_nyc.length}/-${removed_lines_nyc.length} lines)`,
    });
  }
}

// ── Extraction helpers ──

function extract_function_names_nyc(lines_nyc) {
  const names_nyc = new Set();
  for (const line_nyc of lines_nyc) {
    const fn_match_nyc = line_nyc.match(/^[+-]\s*(?:async\s+)?function\s+(\w+)/);
    if (fn_match_nyc) names_nyc.add(fn_match_nyc[1]);

    const arrow_match_nyc = line_nyc.match(/^[+-]\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    if (arrow_match_nyc) names_nyc.add(arrow_match_nyc[1]);
  }
  return [...names_nyc];
}

function extract_constants_nyc(lines_nyc) {
  const constants_nyc = {};
  for (const line_nyc of lines_nyc) {
    // Only match module-level constants (no indentation beyond the diff prefix)
    const match_nyc = line_nyc.match(/^[+-]const\s+([a-zA-Z_]\w*)\s*=\s*(.+?)\s*;/);
    if (match_nyc) constants_nyc[match_nyc[1]] = match_nyc[2];
  }
  return constants_nyc;
}

function extract_params_nyc(lines_nyc) {
  const params_nyc = {};
  for (const line_nyc of lines_nyc) {
    const match_nyc = line_nyc.match(/^[+-]\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (match_nyc) params_nyc[match_nyc[1]] = match_nyc[2].trim();
  }
  return params_nyc;
}

function extract_object_fields_nyc(lines_nyc) {
  const fields_nyc = new Set();
  for (const line_nyc of lines_nyc) {
    // Match object property patterns: key: value or key,
    const match_nyc = line_nyc.match(/^[+-]\s+(\w+)\s*[:,]/);
    if (match_nyc && !['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while'].includes(match_nyc[1])) {
      fields_nyc.add(match_nyc[1]);
    }
  }
  return [...fields_nyc];
}

// ── Main ──

const result_nyc = analyze_changes_nyc();
console.log(JSON.stringify(result_nyc, null, 2));
