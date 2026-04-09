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

function analyzeChanges_nyc() {
  const tier1_nyc = [];
  const tier2_nyc = [];

  // Get list of changed files vs previous commit
  const nameStatus_nyc = run_nyc('git diff HEAD~1 --name-status');
  if (!nameStatus_nyc) {
    // No previous commit or no changes
    return { tier1_nyc, tier2_nyc };
  }

  const changedFiles_nyc = nameStatus_nyc.split('\n').filter(Boolean);

  for (const line_nyc of changedFiles_nyc) {
    const parts_nyc = line_nyc.split('\t');
    const status_nyc = parts_nyc[0];
    const file_nyc = parts_nyc[parts_nyc.length - 1];
    const oldFile_nyc = parts_nyc.length > 2 ? parts_nyc[1] : null;

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
        oldFile_nyc,
        newFile_nyc: file_nyc,
        description: `File renamed: ${oldFile_nyc} -> ${file_nyc}`,
      });
      continue;
    }

    // ── Modified file_nyc: analyze the diff ──
    if (status_nyc === 'M') {
      const diff_nyc = run_nyc(`git diff HEAD~1 -- "${file_nyc}"`);
      analyzeDiff_nyc(file_nyc, diff_nyc, tier1_nyc, tier2_nyc);
    }
  }

  return { tier1_nyc, tier2_nyc };
}

function analyzeDiff_nyc(file_nyc, diff_nyc, tier1_nyc, tier2_nyc) {
  const lines_nyc = diff_nyc.split('\n');
  const addedLines_nyc = lines_nyc.filter((l_nyc) => l_nyc.startsWith('+') && !l_nyc.startsWith('+++'));
  const removedLines_nyc = lines_nyc.filter((l_nyc) => l_nyc.startsWith('-') && !l_nyc.startsWith('---'));

  // ── Detect function renames (Tier 1) ──
  const removedFunctions_nyc = extractFunctionNames_nyc(removedLines_nyc);
  const addedFunctions_nyc = extractFunctionNames_nyc(addedLines_nyc);

  const removedOnly_nyc = removedFunctions_nyc.filter((f_nyc) => !addedFunctions_nyc.includes(f_nyc));
  const addedOnly_nyc = addedFunctions_nyc.filter((f_nyc) => !removedFunctions_nyc.includes(f_nyc));

  if (removedOnly_nyc.length > 0 && addedOnly_nyc.length > 0 && removedOnly_nyc.length === addedOnly_nyc.length) {
    for (let i_nyc = 0; i_nyc < removedOnly_nyc.length; i_nyc++) {
      tier1_nyc.push({
        type: 'function_renamed',
        file_nyc,
        oldName_nyc: removedOnly_nyc[i_nyc],
        newName_nyc: addedOnly_nyc[i_nyc],
        description: `Function renamed in ${file_nyc}: ${removedOnly_nyc[i_nyc]} -> ${addedOnly_nyc[i_nyc]}`,
      });
    }
  } else if (addedOnly_nyc.length > 0 && removedOnly_nyc.length === 0) {
    for (const fn_nyc of addedOnly_nyc) {
      tier2_nyc.push({
        type: 'new_function',
        file_nyc,
        name_nyc: fn_nyc,
        description: `New function added in ${file_nyc}: ${fn_nyc}`,
      });
    }
  }

  // ── Detect constant value changes (Tier 1) ──
  const removedConstants_nyc = extractConstants_nyc(removedLines_nyc);
  const addedConstants_nyc = extractConstants_nyc(addedLines_nyc);
  for (const [name_nyc, oldVal_nyc] of Object.entries(removedConstants_nyc)) {
    if (addedConstants_nyc[name_nyc] && addedConstants_nyc[name_nyc] !== oldVal_nyc) {
      tier1_nyc.push({
        type: 'constant_changed',
        file_nyc,
        name_nyc,
        oldValue_nyc: oldVal_nyc,
        newValue_nyc: addedConstants_nyc[name_nyc],
        description: `Constant changed in ${file_nyc}: ${name_nyc} = ${oldVal_nyc} -> ${addedConstants_nyc[name_nyc]}`,
      });
    }
  }

  // ── Detect parameter changes (Tier 1) ──
  const removedParams_nyc = extractParams_nyc(removedLines_nyc);
  const addedParams_nyc = extractParams_nyc(addedLines_nyc);
  for (const [fn_nyc, oldParams_nyc] of Object.entries(removedParams_nyc)) {
    if (addedParams_nyc[fn_nyc] && addedParams_nyc[fn_nyc] !== oldParams_nyc) {
      tier1_nyc.push({
        type: 'params_changed',
        file_nyc,
        function: fn_nyc,
        oldParams_nyc,
        newParams_nyc: addedParams_nyc[fn_nyc],
        description: `Parameters changed for ${fn_nyc} in ${file_nyc}`,
      });
    }
  }

  // ── Detect field/property renames in objects (Tier 1) ──
  const removedFields_nyc = extractObjectFields_nyc(removedLines_nyc);
  const addedFields_nyc = extractObjectFields_nyc(addedLines_nyc);
  const fieldRemovedOnly_nyc = removedFields_nyc.filter((f_nyc) => !addedFields_nyc.includes(f_nyc));
  const fieldAddedOnly_nyc = addedFields_nyc.filter((f_nyc) => !removedFields_nyc.includes(f_nyc));
  if (fieldRemovedOnly_nyc.length > 0 && fieldAddedOnly_nyc.length > 0 && fieldRemovedOnly_nyc.length === fieldAddedOnly_nyc.length) {
    for (let i_nyc = 0; i_nyc < fieldRemovedOnly_nyc.length; i_nyc++) {
      tier1_nyc.push({
        type: 'field_renamed',
        file_nyc,
        oldName_nyc: fieldRemovedOnly_nyc[i_nyc],
        newName_nyc: fieldAddedOnly_nyc[i_nyc],
        description: `Field renamed in ${file_nyc}: ${fieldRemovedOnly_nyc[i_nyc]} -> ${fieldAddedOnly_nyc[i_nyc]}`,
      });
    }
  }

  // ── Detect endpoint URL changes (Tier 1) ──
  const urlPattern_nyc = /['"`]((?:https?:\/\/|\/api\/|\/v\d+\/)\S+)['"`]/;
  const removedUrls_nyc = removedLines_nyc
    .map((l_nyc) => { const m_nyc = l_nyc.match(urlPattern_nyc); return m_nyc ? m_nyc[1] : null; })
    .filter(Boolean);
  const addedUrls_nyc = addedLines_nyc
    .map((l_nyc) => { const m_nyc = l_nyc.match(urlPattern_nyc); return m_nyc ? m_nyc[1] : null; })
    .filter(Boolean);
  const urlRemovedOnly_nyc = removedUrls_nyc.filter((u_nyc) => !addedUrls_nyc.includes(u_nyc));
  const urlAddedOnly_nyc = addedUrls_nyc.filter((u_nyc) => !removedUrls_nyc.includes(u_nyc));
  if (urlRemovedOnly_nyc.length > 0 || urlAddedOnly_nyc.length > 0) {
    tier1_nyc.push({
      type: 'endpoint_url_changed',
      file_nyc,
      removedUrls_nyc: urlRemovedOnly_nyc,
      addedUrls_nyc: urlAddedOnly_nyc,
      description: `Endpoint URL changes in ${file_nyc} (${urlRemovedOnly_nyc.length} removed, ${urlAddedOnly_nyc.length} added)`,
    });
  }

  // ── Detect credential/config value changes (Tier 1) ──
  const credentialPattern_nyc = /\b(api_key|apikey|api_token|token|secret|password|credential|auth|base_url|endpoint)\b/i;
  const removedCreds_nyc = removedLines_nyc.filter((l_nyc) => credentialPattern_nyc.test(l_nyc));
  const addedCreds_nyc = addedLines_nyc.filter((l_nyc) => credentialPattern_nyc.test(l_nyc));
  if ((removedCreds_nyc.length > 0 || addedCreds_nyc.length > 0) &&
      !(removedCreds_nyc.length === addedCreds_nyc.length && removedCreds_nyc.every((l_nyc, i_nyc) => addedCreds_nyc[i_nyc]?.substring(1) === l_nyc.substring(1)))) {
    tier1_nyc.push({
      type: 'credential_config_changed',
      file_nyc,
      description: `Publicly available credential/config changes in ${file_nyc} (${addedCreds_nyc.length} added, ${removedCreds_nyc.length} removed)`,
    });
  }

  // ── Detect major structural changes (Human Review) ──
  const newImports_nyc = addedLines_nyc.filter(
    (l_nyc) => l_nyc.match(/^\+.*require\s*\(/) || l_nyc.match(/^\+.*import\s+/)
  );
  const removedImports_nyc = removedLines_nyc.filter(
    (l_nyc) => l_nyc.match(/^-.*require\s*\(/) || l_nyc.match(/^-.*import\s+/)
  );
  if (newImports_nyc.length > 2 || removedImports_nyc.length > 2) {
    tier2_nyc.push({
      type: 'major_structural_change',
      file_nyc,
      description: `Major import/require changes in ${file_nyc} (${newImports_nyc.length} added, ${removedImports_nyc.length} removed) — may require customer-side updates`,
    });
  }

  // ── Detect API type changes e.g. SOAP to REST (Human Review) ──
  // Use (?=\b|_) lookahead so suffixed names (e.g. rest_nyc) match but prefixed words (e.g. restore) don't
  const apiTypePattern_nyc = /\b(soap|restful|rest(?:\s*api)?|graphql|grpc|websocket|xml-rpc|json-rpc)(?=\b|_)/i;
  const removedApiTypes_nyc = removedLines_nyc.filter((l_nyc) => apiTypePattern_nyc.test(l_nyc));
  const addedApiTypes_nyc = addedLines_nyc.filter((l_nyc) => apiTypePattern_nyc.test(l_nyc));
  if (removedApiTypes_nyc.length > 0 && addedApiTypes_nyc.length > 0) {
    tier2_nyc.push({
      type: 'api_type_change',
      file_nyc,
      description: `API type/protocol changes detected in ${file_nyc} (${removedApiTypes_nyc.length} removed, ${addedApiTypes_nyc.length} added)`,
    });
  }

  // ── Detect metrics-related changes (Human Review) ──
  // Use (?=\b|_) lookahead so suffixed names (e.g. metrics_nyc) match but prefixed words (e.g. targetElement) don't
  const metricsPattern_nyc = /^\+.*\b(metric|metrics|kpi|kpis|measure|measurement|outcome|outcomes|goal|goals|target|targets|benchmark|conversion|retention|churn|revenue|arpu|ltv|ctr|engagement|funnel|analytics|tracking|telemetry)(?=\b|_)/i;
  const metricsLines_nyc = addedLines_nyc.filter((l_nyc) => metricsPattern_nyc.test(l_nyc));
  const removedMetricsLines_nyc = removedLines_nyc.filter((l_nyc) =>
    /^-.*\b(metric|metrics|kpi|kpis|measure|measurement|outcome|outcomes|goal|goals|target|targets|benchmark|conversion|retention|churn|revenue|arpu|ltv|ctr|engagement|funnel|analytics|tracking|telemetry)(?=\b|_)/i.test(l_nyc)
  );
  if (metricsLines_nyc.length > 0 || removedMetricsLines_nyc.length > 0) {
    tier2_nyc.push({
      type: 'metrics_change',
      file_nyc,
      description: `Metrics-related changes in ${file_nyc} (${metricsLines_nyc.length} added, ${removedMetricsLines_nyc.length} removed)`,
    });
  }

  // ── Comment-only changes = Tier 2 ──
  const commentPattern_nyc = /^[+-]\s*(\/\/|\/\*|\*)/;
  const nonCommentAdded_nyc = addedLines_nyc.filter((l_nyc) => !commentPattern_nyc.test(l_nyc));
  const nonCommentRemoved_nyc = removedLines_nyc.filter((l_nyc) => !commentPattern_nyc.test(l_nyc));
  const commentAdded_nyc = addedLines_nyc.filter((l_nyc) => commentPattern_nyc.test(l_nyc));

  if (commentAdded_nyc.length > 0 && nonCommentAdded_nyc.length === 0 && nonCommentRemoved_nyc.length === 0) {
    tier2_nyc.push({
      type: 'comments_changed',
      file_nyc,
      description: `Comments updated in ${file_nyc}`,
    });
    return; // Don't also flag as significant change
  }

  // ── Large changes without clear rename = Tier 2 ──
  const alreadyCategorized_nyc = tier1_nyc.some((t_nyc) => t_nyc.file_nyc === file_nyc) || tier2_nyc.some((t_nyc) => t_nyc.file_nyc === file_nyc);
  if (!alreadyCategorized_nyc && addedLines_nyc.length > 20) {
    tier2_nyc.push({
      type: 'significant_change',
      file_nyc,
      linesAdded_nyc: addedLines_nyc.length,
      linesRemoved_nyc: removedLines_nyc.length,
      description: `Significant changes in ${file_nyc} (+${addedLines_nyc.length}/-${removedLines_nyc.length} lines)`,
    });
  }
}

// ── Extraction helpers ──

function extractFunctionNames_nyc(lines_nyc) {
  const names_nyc = new Set();
  for (const line_nyc of lines_nyc) {
    const fnMatch_nyc = line_nyc.match(/^[+-]\s*(?:async\s+)?function\s+(\w+)/);
    if (fnMatch_nyc) names_nyc.add(fnMatch_nyc[1]);

    const arrowMatch_nyc = line_nyc.match(/^[+-]\s*(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(/);
    if (arrowMatch_nyc) names_nyc.add(arrowMatch_nyc[1]);
  }
  return [...names_nyc];
}

function extractConstants_nyc(lines_nyc) {
  const constants_nyc = {};
  for (const line_nyc of lines_nyc) {
    // Only match module-level constants (no indentation beyond the diff prefix)
    const match_nyc = line_nyc.match(/^[+-]const\s+([a-zA-Z_]\w*)\s*=\s*(.+?)\s*;/);
    if (match_nyc) constants_nyc[match_nyc[1]] = match_nyc[2];
  }
  return constants_nyc;
}

function extractParams_nyc(lines_nyc) {
  const params_nyc = {};
  for (const line_nyc of lines_nyc) {
    const match_nyc = line_nyc.match(/^[+-]\s*(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/);
    if (match_nyc) params_nyc[match_nyc[1]] = match_nyc[2].trim();
  }
  return params_nyc;
}

function extractObjectFields_nyc(lines_nyc) {
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

const result_nyc = analyzeChanges_nyc();
console.log(JSON.stringify(result_nyc, null, 2));
