/**
 * Syncs the reservation system design spec to a Notion page.
 *
 * Reads the source files, generates structured Notion blocks,
 * and replaces the content of the target Notion page.
 *
 * Required env vars:
 *   NOTION_TOKEN   - Notion integration token (starts with ntn_)
 *   NOTION_PAGE_ID - ID of the Notion page to update
 */

const fs_nyc = require('fs');
const path_nyc = require('path');

const NOTION_API_nyc = 'https://api.notion.com/v1';
const NOTION_VERSION_nyc = '2022-06-28';

const NOTION_TOKEN_nyc = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID_nyc = process.env.NOTION_PAGE_ID;

if (!NOTION_TOKEN_nyc || !NOTION_PAGE_ID_nyc) {
  console.error('Missing NOTION_TOKEN or NOTION_PAGE_ID environment variables.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN_nyc}`,
  'Notion-Version': NOTION_VERSION_nyc,
  'Content-Type': 'application/json',
};

// ─── Notion API helpers ───────────────────────────────────────────────

async function notionRequest_nyc(endpoint_nyc, method_nyc = 'GET', body_nyc = null) {
  const opts_nyc = { method: method_nyc, headers };
  if (body_nyc) opts_nyc.body = JSON.stringify(body_nyc);
  const res_nyc = await fetch(`${NOTION_API_nyc}${endpoint_nyc}`, opts_nyc);
  if (!res_nyc.ok) {
    const text_nyc = await res_nyc.text();
    throw new Error(`Notion API ${method_nyc} ${endpoint_nyc} failed (${res_nyc.status}): ${text_nyc}`);
  }
  return res_nyc.json();
}

async function getChildBlocks_nyc(blockId_nyc) {
  const blocks_nyc = [];
  let cursor_nyc;
  do {
    const qs_nyc = cursor_nyc ? `?start_cursor=${cursor_nyc}` : '';
    const data_nyc = await notionRequest_nyc(`/blocks/${blockId_nyc}/children${qs_nyc}`);
    blocks_nyc.push(...data_nyc.results);
    cursor_nyc = data_nyc.has_more ? data_nyc.next_cursor : null;
  } while (cursor_nyc);
  return blocks_nyc;
}

async function deleteBlock_nyc(blockId_nyc) {
  return notionRequest_nyc(`/blocks/${blockId_nyc}`, 'DELETE');
}

async function appendChildren_nyc(blockId_nyc, children_nyc) {
  // Notion limits to 100 blocks per request
  for (let i_nyc = 0; i_nyc < children_nyc.length; i_nyc += 100) {
    const batch_nyc = children_nyc.slice(i_nyc, i_nyc + 100);
    await notionRequest_nyc(`/blocks/${blockId_nyc}/children`, 'PATCH', { children: batch_nyc });
  }
}

// ─── Notion block builders ───────────────────────────────────────────

function richText_nyc(content, opts_nyc = {}) {
  const text_nyc = { content };
  if (opts_nyc.link) text_nyc.link = { url: opts_nyc.link };
  const annotations_nyc = {};
  if (opts_nyc.bold) annotations_nyc.bold = true;
  if (opts_nyc.italic) annotations_nyc.italic = true;
  if (opts_nyc.code) annotations_nyc.code = true;
  return { type: 'text', text: text_nyc, ...(Object.keys(annotations_nyc).length ? { annotations: annotations_nyc } : {}) };
}

function heading1_nyc(text) {
  return {
    object: 'block',
    type: 'heading_1',
    heading_1: { rich_text: [richText_nyc(text)] },
  };
}

function heading2_nyc(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [richText_nyc(text)] },
  };
}

function heading3_nyc(text) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [richText_nyc(text)] },
  };
}

function paragraph_nyc(segments_nyc) {
  if (typeof segments_nyc === 'string') segments_nyc = [richText_nyc(segments_nyc)];
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: segments_nyc },
  };
}

function bulletItem_nyc(segments_nyc) {
  if (typeof segments_nyc === 'string') segments_nyc = [richText_nyc(segments_nyc)];
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: segments_nyc },
  };
}

function codeBlock_nyc(content, language_nyc = 'javascript') {
  // Notion limits each rich_text segment to 2000 chars
  const MAX_LEN_nyc = 2000;
  const segments_nyc = [];
  for (let i_nyc = 0; i_nyc < content.length; i_nyc += MAX_LEN_nyc) {
    segments_nyc.push(richText_nyc(content.slice(i_nyc, i_nyc + MAX_LEN_nyc)));
  }
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: segments_nyc,
      language: language_nyc,
    },
  };
}

function divider_nyc() {
  return { object: 'block', type: 'divider', divider: {} };
}

function tableBlock_nyc(headers, rows) {
  const width_nyc = headers.length;
  const headerRow_nyc = {
    object: 'block',
    type: 'table_row',
    table_row: { cells: headers.map((h_nyc) => [richText_nyc(h_nyc, { bold: true })]) },
  };
  const dataRows_nyc = rows.map((row_nyc) => ({
    object: 'block',
    type: 'table_row',
    table_row: { cells: row_nyc.map((cell_nyc) => [richText_nyc(cell_nyc)]) },
  }));
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: width_nyc,
      has_column_header: true,
      has_row_header: false,
      children: [headerRow_nyc, ...dataRows_nyc],
    },
  };
}

function callout_nyc(text, emoji_nyc = 'ℹ️') {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [richText_nyc(text)],
      icon: { type: 'emoji', emoji: emoji_nyc },
    },
  };
}

// ─── Read source files ───────────────────────────────────────────────

function readSource_nyc(filename_nyc) {
  const filePath_nyc = path_nyc.resolve(__dirname, '..', 'src', filename_nyc);
  return fs_nyc.readFileSync(filePath_nyc, 'utf-8');
}

// ─── Extract dynamic names from source ──────────────────────────────

function extractNames_nyc(parseRequestSrc_nyc, mockApiSrc_nyc, handleReservationSrc_nyc) {
  // Helper: extract exported names from module.exports = { ... }
  function getExports_nyc(src_nyc) {
    const m_nyc = src_nyc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    return m_nyc ? m_nyc[1].split(',').map(function(s_nyc) { return s_nyc.trim(); }).filter(Boolean) : [];
  }

  // Extract function names from exports
  const parseExports_nyc = getExports_nyc(parseRequestSrc_nyc);
  const apiExports_nyc = getExports_nyc(mockApiSrc_nyc);
  const handleExports_nyc = getExports_nyc(handleReservationSrc_nyc);

  const parseFn_nyc = parseExports_nyc[0] || 'parseRequest';
  const checkAvailFn_nyc = apiExports_nyc.find(function(x_nyc) { return /avail/i.test(x_nyc); }) || 'checkAvailability';
  const makeResFn_nyc = apiExports_nyc.find(function(x_nyc) { return /reserv/i.test(x_nyc); }) || 'makeReservation';
  const resetFn_nyc = apiExports_nyc.find(function(x_nyc) { return /reset/i.test(x_nyc); }) || 'resetBookings';
  const handleFn_nyc = handleExports_nyc[0] || 'handleReservationRequest';

  // Extract field names from parseRequest return statement
  // Use non-greedy match and limit to first return block (the one inside the main function)
  const returnMatch_nyc = parseRequestSrc_nyc.match(/return\s*\{\s*(\w+)\s*:[^,]+,\s*(\w+)\s*:[^,]+,\s*(\w+)\s*:/);
  const dateField_nyc = returnMatch_nyc ? returnMatch_nyc[1] : 'date';
  const timeField_nyc = returnMatch_nyc ? returnMatch_nyc[2] : 'time';
  const partySizeField_nyc = returnMatch_nyc ? returnMatch_nyc[3] : 'partySize';

  // Extract capacity value from mockApi (first const with a number value)
  const capacityMatch_nyc = mockApiSrc_nyc.match(/const\s+\w+\s*=\s*(\d+)/);
  const capacityVal_nyc = capacityMatch_nyc ? capacityMatch_nyc[1] : '20';

  // Extract threshold constants from handleReservation
  const constMatches_nyc = Array.from(handleReservationSrc_nyc.matchAll(/const\s+(\w+)\s*=\s*(\d+)\s*;/g));
  let largePartyThreshold_nyc = '6';
  let lateNightHour_nyc = '21';
  for (const m_nyc of constMatches_nyc) {
    if (/party|threshold/i.test(m_nyc[1])) largePartyThreshold_nyc = m_nyc[2];
    else if (/night|hour/i.test(m_nyc[1])) lateNightHour_nyc = m_nyc[2];
  }

  // Extract response field names from the success return in handleReservation
  // Use brace-depth tracking to correctly handle nested objects and template literals
  let successField_nyc = 'success';
  let messageField_nyc = 'message';
  let confirmationField_nyc = 'confirmation';
  let detailsField_nyc = 'details';
  let metricsField_nyc = 'metrics';
  const srcLines_nyc = handleReservationSrc_nyc.split('\n');
  let braceDepth_nyc = 0;
  let inReturn_nyc = false;
  let returnBlock_nyc = '';
  let successBlock_nyc = null;
  for (let i_nyc = 0; i_nyc < srcLines_nyc.length; i_nyc++) {
    const line_nyc = srcLines_nyc[i_nyc];
    if (!inReturn_nyc && /return\s*\{/.test(line_nyc)) {
      inReturn_nyc = true;
      braceDepth_nyc = 0;
      returnBlock_nyc = '';
    }
    if (inReturn_nyc) {
      returnBlock_nyc += line_nyc + '\n';
      for (const ch_nyc of line_nyc) {
        if (ch_nyc === '{') braceDepth_nyc++;
        if (ch_nyc === '}') braceDepth_nyc--;
      }
      if (braceDepth_nyc <= 0) {
        if (/\w+:\s*true/.test(returnBlock_nyc)) {
          successBlock_nyc = returnBlock_nyc;
        }
        inReturn_nyc = false;
        returnBlock_nyc = '';
      }
    }
  }
  if (successBlock_nyc) {
    // Extract top-level fields using brace depth (handles both 'key:' and shorthand 'key,')
    const blockLines_nyc = successBlock_nyc.split('\n');
    let depth_nyc = 0;
    const topFields_nyc = [];
    for (const fl_nyc of blockLines_nyc) {
      const prevDepth_nyc = depth_nyc;
      for (const ch_nyc of fl_nyc) {
        if (ch_nyc === '{') depth_nyc++;
        if (ch_nyc === '}') depth_nyc--;
      }
      if (prevDepth_nyc === 1 && depth_nyc >= 1) {
        const mExplicit_nyc = fl_nyc.match(/^\s*(\w+)\s*:/);
        const mShorthand_nyc = fl_nyc.match(/^\s*(\w+)\s*,?\s*$/);
        if (mExplicit_nyc) topFields_nyc.push(mExplicit_nyc[1]);
        else if (mShorthand_nyc) topFields_nyc.push(mShorthand_nyc[1]);
      }
    }
    if (topFields_nyc.length >= 2) {
      successField_nyc = topFields_nyc[0];
      messageField_nyc = topFields_nyc[1];
    }
    const cf_nyc = topFields_nyc.find(function(f_nyc) { return /confirm/i.test(f_nyc); });
    if (cf_nyc) confirmationField_nyc = cf_nyc;
    const df_nyc = topFields_nyc.find(function(f_nyc) { return /detail/i.test(f_nyc); });
    if (df_nyc) detailsField_nyc = df_nyc;
    const mf_nyc = topFields_nyc.find(function(f_nyc) { return /metric/i.test(f_nyc); });
    if (mf_nyc) metricsField_nyc = mf_nyc;
  }

  // Extract metric field names from: metrics_nyc.FIELD = true
  const metricMatches_nyc = Array.from(handleReservationSrc_nyc.matchAll(/\w+\.(\w+)\s*=\s*true/g));
  const largePartyMetric_nyc = metricMatches_nyc[0] ? metricMatches_nyc[0][1] : 'largeParty';
  const lateNightMetric_nyc = metricMatches_nyc[1] ? metricMatches_nyc[1][1] : 'lateNight';

  // Extract available field from first function return in mockApi
  const availReturnMatch_nyc = mockApiSrc_nyc.match(/return\s*\{\s*(\w+)\s*\}/);
  const availableField_nyc = availReturnMatch_nyc ? availReturnMatch_nyc[1] : 'available';

  // Extract confirmation field from second function return in mockApi
  const allReturns_nyc = Array.from(mockApiSrc_nyc.matchAll(/return\s*\{\s*(\w+)\s*\}/g));
  const confirmField_nyc = allReturns_nyc.length > 1 ? allReturns_nyc[1][1] : 'confirmation';

  return {
    parseFn: parseFn_nyc,
    checkAvailFn: checkAvailFn_nyc,
    makeResFn: makeResFn_nyc,
    resetFn: resetFn_nyc,
    handleFn: handleFn_nyc,
    dateField: dateField_nyc,
    timeField: timeField_nyc,
    partySizeField: partySizeField_nyc,
    capacityVal: capacityVal_nyc,
    largePartyThreshold: largePartyThreshold_nyc,
    lateNightHour: lateNightHour_nyc,
    successField: successField_nyc,
    messageField: messageField_nyc,
    confirmationField: confirmationField_nyc,
    detailsField: detailsField_nyc,
    metricsField: metricsField_nyc,
    largePartyMetric: largePartyMetric_nyc,
    lateNightMetric: lateNightMetric_nyc,
    availableField: availableField_nyc,
    confirmField: confirmField_nyc,
  };
}

// --- Build the page content ---

function buildPageBlocks_nyc() {
  const parseRequestSrc_nyc = readSource_nyc('parseRequest.js');
  const mockApiSrc_nyc = readSource_nyc('mockApi.js');
  const handleReservationSrc_nyc = readSource_nyc('handleReservation.js');
  const indexSrc_nyc = readSource_nyc('index.js');

  // Extract all dynamic names from source files
  const n_nyc = extractNames_nyc(parseRequestSrc_nyc, mockApiSrc_nyc, handleReservationSrc_nyc);

  const blocks_nyc = [
    // --- Overview ---
    heading1_nyc('Overview'),
    paragraph_nyc(
      'The Reservation System is a lightweight Node.js module that allows any restaurant to accept reservations through natural language input. It parses human-readable requests, checks table availability, and books the reservation \u2014 all through a simple JavaScript API.'
    ),
    callout_nyc(
      'This system is designed to be integrated into any restaurant\'s existing tech stack. Replace the mock API layer (mockApi.js) with calls to your own database or booking service to go live.',
      '\uD83D\uDD0C'
    ),
    divider_nyc(),

    // --- Architecture ---
    heading1_nyc('Architecture'),
    codeBlock_nyc(
      '\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n' +
        '\u2502                  Customer Input                      \u2502\n' +
        '\u2502     "Table for 4 on March 15th at 7pm"              \u2502\n' +
        '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n' +
        '                       \u2502\n' +
        '                       \u25BC\n' +
        '\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n' +
        '\u2502            handleReservationRequest()                \u2502\n' +
        '\u2502                  (Orchestrator)                      \u2502\n' +
        '\u2502                                                     \u2502\n' +
        '\u2502  1. Parse the natural language input                 \u2502\n' +
        '\u2502  2. Validate all fields are present                  \u2502\n' +
        '\u2502  3. Check availability                               \u2502\n' +
        '\u2502  4. Book the reservation                             \u2502\n' +
        '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u252C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518\n' +
        '       \u2502              \u2502              \u2502\n' +
        '       \u25BC              \u25BC              \u25BC\n' +
        '\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510 \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510 \u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2510\n' +
        '\u2502parseRequest \u2502 \u2502 checkAvail- \u2502 \u2502 makeReservation  \u2502\n' +
        '\u2502   (Parser) \u2502 \u2502  ability    \u2502 \u2502    (Booking)     \u2502\n' +
        '\u2502            \u2502 \u2502  (Mock API) \u2502 \u2502   (Mock API)     \u2502\n' +
        '\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518 \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518',
      'plain text'
    ),

    heading2_nyc('File Structure'),
    tableBlock_nyc(
      ['File', 'Purpose'],
      [
        ['src/parseRequest.js', 'Regex-based natural language parser \u2014 extracts date, time, and party size'],
        ['src/mockApi.js', 'Mock booking database \u2014 check availability and create reservations'],
        ['src/handleReservation.js', 'Orchestrator \u2014 ties parsing, availability, and booking together'],
        ['src/index.js', 'Demo entry point \u2014 run with node src/index.js'],
        ['tests/parseRequest.test.js', '10 unit tests for the parser'],
        ['tests/handleReservation.test.js', '7 integration tests for the full flow'],
      ]
    ),
    divider_nyc(),

    // --- Module 1: Parser ---
    heading1_nyc('Module 1: Natural Language Parser'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/parseRequest.js', { code: true })]),

    heading2_nyc(`${n_nyc.parseFn}(text)`),
    paragraph_nyc('Parses a natural language string and extracts reservation details using regex.'),
    paragraph_nyc([richText_nyc('Input: ', { bold: true }), richText_nyc('A string like "I\'d like a table for 4 on March 15th at 7pm"')]),
    paragraph_nyc([richText_nyc('Output:', { bold: true })]),
    codeBlock_nyc(`{\n  "${n_nyc.dateField}": "2026-03-15",\n  "${n_nyc.timeField}": "19:00",\n  "${n_nyc.partySizeField}": 4\n}`, 'json'),
    paragraph_nyc('Any field that cannot be extracted returns null.'),

    heading3_nyc('Supported Date Formats'),
    tableBlock_nyc(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['ISO 8601', '2025-04-10', '2025-04-10'],
        ['Month name + day', 'March 15 or March 15th', 'YYYY-03-15'],
        ['Numeric (US)', '12/25 or 12/25/2026', 'YYYY-12-25'],
      ]
    ),
    paragraph_nyc('When no year is provided, the system infers the next upcoming occurrence of that date.'),

    heading3_nyc('Supported Time Formats'),
    tableBlock_nyc(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['12-hour with minutes', '6:30 PM', '18:30'],
        ['12-hour without minutes', '7pm', '19:00'],
        ['24-hour', '19:00', '19:00'],
      ]
    ),
    paragraph_nyc('All times are normalized to HH:MM in 24-hour format.'),

    heading3_nyc('Supported Party Size Patterns'),
    tableBlock_nyc(
      ['Pattern', 'Example Input'],
      [
        ['for X', 'table for 4'],
        ['X people', '2 people'],
        ['party of X', 'party of 8'],
      ]
    ),
    paragraph_nyc('Also recognizes: persons, guests, diners.'),

    heading3_nyc('Source Code'),
    codeBlock_nyc(parseRequestSrc_nyc, 'javascript'),
    divider_nyc(),

    // --- Module 2: Booking API ---
    heading1_nyc('Module 2: Booking API'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/mockApi.js', { code: true })]),
    callout_nyc(
      'To integrate with a real system, replace the functions in this file with calls to your actual database or booking service. Keep the same function signatures and return types.',
      '\uD83D\uDD27'
    ),

    heading2_nyc(`${n_nyc.checkAvailFn}({ ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} })`),
    paragraph_nyc('Checks whether a time slot has room for the requested party.'),
    heading3_nyc('Parameters'),
    tableBlock_nyc(
      ['Field', 'Type', 'Description'],
      [
        [n_nyc.dateField, 'string', 'Date in YYYY-MM-DD format'],
        [n_nyc.timeField, 'string', 'Time in HH:MM (24-hour) format'],
        [n_nyc.partySizeField, 'number', 'Number of guests'],
      ]
    ),
    paragraph_nyc([richText_nyc('Returns: ', { bold: true }), richText_nyc(`Promise<{ ${n_nyc.availableField}: boolean }>`)]),
    paragraph_nyc(`A time slot (date + time combination) has a capacity of ${n_nyc.capacityVal} guests. If the total booked guests plus the new party size exceeds ${n_nyc.capacityVal}, the slot is unavailable.`),
    codeBlock_nyc(
      `const { ${n_nyc.checkAvailFn} } = require('./mockApi');\n\n` +
        `const result_nyc = await ${n_nyc.checkAvailFn}({\n` +
        `  ${n_nyc.dateField}: '2026-12-25',\n` +
        `  ${n_nyc.timeField}: '19:00',\n` +
        `  ${n_nyc.partySizeField}: 4\n` +
        '});\n' +
        `// \u2192 { ${n_nyc.availableField}: true }`,
      'javascript'
    ),

    heading2_nyc(`${n_nyc.makeResFn}({ ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} })`),
    paragraph_nyc('Creates a reservation and returns a unique confirmation ID.'),
    heading3_nyc('Parameters'),
    tableBlock_nyc(
      ['Field', 'Type', 'Description'],
      [
        [n_nyc.dateField, 'string', 'Date in YYYY-MM-DD format'],
        [n_nyc.timeField, 'string', 'Time in HH:MM (24-hour) format'],
        [n_nyc.partySizeField, 'number', 'Number of guests'],
      ]
    ),
    paragraph_nyc([richText_nyc('Returns: ', { bold: true }), richText_nyc(`Promise<{ ${n_nyc.confirmField}: string }>`)]),
    paragraph_nyc('The confirmation ID follows the format RES-XXXXX (5 random alphanumeric characters).'),
    codeBlock_nyc(
      `const { ${n_nyc.makeResFn} } = require('./mockApi');\n\n` +
        `const result_nyc = await ${n_nyc.makeResFn}({\n` +
        `  ${n_nyc.dateField}: '2026-12-25',\n` +
        `  ${n_nyc.timeField}: '19:00',\n` +
        `  ${n_nyc.partySizeField}: 4\n` +
        '});\n' +
        `// \u2192 { ${n_nyc.confirmField}: "RES-A3F7K" }`,
      'javascript'
    ),

    heading2_nyc(`${n_nyc.resetFn}()`),
    paragraph_nyc('Resets the in-memory booking store. Intended for testing use only.'),
    codeBlock_nyc(
      `const { ${n_nyc.resetFn} } = require('./mockApi');\n${n_nyc.resetFn}(); // clears all bookings`,
      'javascript'
    ),

    heading3_nyc('Source Code'),
    codeBlock_nyc(mockApiSrc_nyc, 'javascript'),
    divider_nyc(),

    // --- Module 3: Orchestrator ---
    heading1_nyc('Module 3: Orchestrator'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/handleReservation.js', { code: true })]),

    heading2_nyc(`${n_nyc.handleFn}(text)`),
    paragraph_nyc(
      'The main entry point for processing a reservation. Takes a natural language string, parses it, checks availability, and either books the reservation or returns an appropriate error.'
    ),
    paragraph_nyc([richText_nyc('Input: ', { bold: true }), richText_nyc('string \u2014 a natural language reservation request')]),
    paragraph_nyc([richText_nyc('Returns: ', { bold: true }), richText_nyc('Promise<object> \u2014 one of three response shapes:')]),

    heading3_nyc('Success Response'),
    codeBlock_nyc(
      '{\n' +
        `  "${n_nyc.successField}": true,\n` +
        `  "${n_nyc.messageField}": "Reservation confirmed! Your confirmation number is RES-A3F7K.",\n` +
        `  "${n_nyc.confirmationField}": "RES-A3F7K",\n` +
        `  "${n_nyc.detailsField}": {\n` +
        `    "${n_nyc.dateField}": "2026-12-25",\n` +
        `    "${n_nyc.timeField}": "19:00",\n` +
        `    "${n_nyc.partySizeField}": 8\n` +
        '  },\n' +
        `  "${n_nyc.metricsField}": {\n` +
        `    "${n_nyc.largePartyMetric}": true\n` +
        '  }\n' +
        '}',
      'json'
    ),
    paragraph_nyc([
      richText_nyc('The '),
      richText_nyc(n_nyc.metricsField, { code: true }),
      richText_nyc(' object is included on all successful responses. '),
      richText_nyc(n_nyc.largePartyMetric, { code: true }),
      richText_nyc(' is set to '),
      richText_nyc('true', { code: true }),
      richText_nyc(` when the party size exceeds ${n_nyc.largePartyThreshold} guests.`),
    ]),

    heading3_nyc('Parsing Failure (missing date, time, or party size)'),
    codeBlock_nyc(
      '{\n' +
        `  "${n_nyc.successField}": false,\n` +
        `  "${n_nyc.messageField}": "Could not understand your reservation request. Please include a date, time, and party size."\n` +
        '}',
      'json'
    ),

    heading3_nyc('Unavailable Slot'),
    codeBlock_nyc(
      '{\n' +
        `  "${n_nyc.successField}": false,\n` +
        `  "${n_nyc.messageField}": "Sorry, that time slot is not available. Please try a different date or time."\n` +
        '}',
      'json'
    ),

    heading3_nyc('Flow'),
    codeBlock_nyc(
      'Input text\n' +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${n_nyc.parseFn}(text)\n` +
        '    \u2502\n' +
        '    \u251C\u2500\u2500 Any field is null? \u2192 Return parsing error\n' +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${n_nyc.checkAvailFn}({ ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} })\n` +
        '    \u2502\n' +
        `    \u251C\u2500\u2500 ${n_nyc.availableField}: false \u2192 Return unavailable error\n` +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${n_nyc.makeResFn}({ ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} })\n` +
        '    \u2502\n' +
        '    \u25BC\n' +
        'Return success with confirmation ID and details',
      'plain text'
    ),

    heading3_nyc('Source Code'),
    codeBlock_nyc(handleReservationSrc_nyc, 'javascript'),
    divider_nyc(),

    // --- Integration Guide ---
    heading1_nyc('Integration Guide'),

    heading2_nyc('Step 1: Install'),
    codeBlock_nyc('npm install', 'bash'),

    heading2_nyc('Step 2: Try the Demo'),
    codeBlock_nyc('node src/index.js', 'bash'),

    heading2_nyc('Step 3: Use in Your Application'),
    codeBlock_nyc(
      `const { ${n_nyc.handleFn} } = require('./src/handleReservation');\n\n` +
        '// From your chatbot, web form, SMS handler, etc.\n' +
        'const userInput_nyc = "Table for 4 on December 25th at 7pm";\n' +
        `const result_nyc = await ${n_nyc.handleFn}(userInput_nyc);\n\n` +
        `if (result_nyc.${n_nyc.successField}) {\n` +
        `  console.log(result_nyc.${n_nyc.messageField});       // "Reservation confirmed! ..."\n` +
        `  console.log(result_nyc.${n_nyc.confirmationField});   // "RES-A3F7K"\n` +
        `  console.log(result_nyc.${n_nyc.detailsField});       // { ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} }\n` +
        '} else {\n' +
        `  console.log(result_nyc.${n_nyc.messageField});\n` +
        '}',
      'javascript'
    ),

    heading2_nyc('Step 4: Connect to Your Real Database'),
    paragraph_nyc([
      richText_nyc('Replace the functions in '),
      richText_nyc('src/mockApi.js', { code: true }),
      richText_nyc(' with your own implementations. The contract to maintain:'),
    ]),
    tableBlock_nyc(
      ['Function', 'Must Accept', 'Must Return'],
      [
        [n_nyc.checkAvailFn, `{ ${n_nyc.dateField}: string, ${n_nyc.timeField}: string, ${n_nyc.partySizeField}: number }`, `Promise<{ ${n_nyc.availableField}: boolean }>`],
        [n_nyc.makeResFn, `{ ${n_nyc.dateField}: string, ${n_nyc.timeField}: string, ${n_nyc.partySizeField}: number }`, `Promise<{ ${n_nyc.confirmField}: string }>`],
      ]
    ),
    paragraph_nyc('Example with a SQL database:'),
    codeBlock_nyc(
      `async function ${n_nyc.checkAvailFn}({ ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} }) {\n` +
        '  const row_nyc = await db.query(\n' +
        "    'SELECT SUM(party_size) AS total FROM reservations WHERE date = ? AND time = ?',\n" +
        `    [${n_nyc.dateField}, ${n_nyc.timeField}]\n` +
        '  );\n' +
        '  const currentCount_nyc = row_nyc.total || 0;\n' +
        `  return { ${n_nyc.availableField}: currentCount_nyc + ${n_nyc.partySizeField} <= YOUR_CAPACITY };\n` +
        '}\n\n' +
        `async function ${n_nyc.makeResFn}({ ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField} }) {\n` +
        '  const confirmation_nyc = generateUniqueId();\n' +
        '  await db.query(\n' +
        "    'INSERT INTO reservations (confirmation, date, time, party_size) VALUES (?, ?, ?, ?)',\n" +
        `    [confirmation_nyc, ${n_nyc.dateField}, ${n_nyc.timeField}, ${n_nyc.partySizeField}]\n` +
        '  );\n' +
        `  return { ${n_nyc.confirmField}: confirmation_nyc };\n` +
        '}',
      'javascript'
    ),
    divider_nyc(),

    // --- Testing ---
    heading1_nyc('Testing'),
    paragraph_nyc('Run all 17 tests:'),
    codeBlock_nyc('npm test', 'bash'),
    tableBlock_nyc(
      ['Test Suite', 'Count', 'What It Covers'],
      [
        ['parseRequest.test.js', '10', 'Date formats, time formats, party size patterns, edge cases, unparseable input'],
        ['handleReservation.test.js', '7', 'Successful booking, capacity exhaustion, incomplete input, missing fields, state reset'],
      ]
    ),
    divider_nyc(),

    // --- Data Formats Reference ---
    heading1_nyc('Data Formats Reference'),
    tableBlock_nyc(
      ['Field', 'Format', 'Example'],
      [
        [n_nyc.dateField, 'YYYY-MM-DD', '2026-12-25'],
        [n_nyc.timeField, 'HH:MM (24-hour)', '19:00'],
        [n_nyc.partySizeField, 'Integer', '4'],
        [n_nyc.confirmationField, 'RES-XXXXX', 'RES-A3F7K'],
      ]
    ),
    divider_nyc(),

    // --- Configuration ---
    heading1_nyc('Configuration'),
    tableBlock_nyc(
      ['Setting', 'Current Value', 'Location', 'Description'],
      [
        ['Slot capacity', `${n_nyc.capacityVal} guests`, 'src/mockApi.js line 1', 'Maximum total guests per date+time slot'],
      ]
    ),
    paragraph_nyc(
      'To change the capacity, update the capacity constant in mockApi.js, or move it to a config file / environment variable for production use.'
    ),
    divider_nyc(),

    // --- Demo Entry Point ---
    heading1_nyc('Demo Entry Point'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/index.js', { code: true })]),
    codeBlock_nyc(indexSrc_nyc, 'javascript'),

    // --- Change Log ---
    heading1_nyc('Change Log'),
    callout_nyc(
      'This section tracks all changes to the reservation system.',
      '\uD83D\uDCCB'
    ),

    heading3_nyc('v1.4.0 \u2014 2026-04-08'),
    bulletItem_nyc('Auto-synced Notion design spec with update system'),
    bulletItem_nyc('Added change analysis pipeline (analyze-changes.js)'),
    bulletItem_nyc('Added review draft generator for proposed documentation updates'),

    heading3_nyc('v1.3.0 \u2014 2026-04-05'),
    bulletItem_nyc('Added support for "diners" keyword in party size parsing'),
    bulletItem_nyc([richText_nyc('Renamed internal helper '), richText_nyc('formatDateString', { code: true }), richText_nyc(' \u2192 '), richText_nyc('formatDate', { code: true })]),
    bulletItem_nyc('Evaluated migration from in-memory store to SQLite \u2014 deferred to v2.0'),

    heading3_nyc('v1.2.0 \u2014 2026-03-28'),
    bulletItem_nyc('capacity constant updated from 15 \u2192 20 guests per slot'),
    bulletItem_nyc([richText_nyc('Added '), richText_nyc('resetBookings()', { code: true }), richText_nyc(' helper for test isolation')]),
    bulletItem_nyc('Fixed 24-hour time parsing fallback for ambiguous formats like 6:30'),

    heading3_nyc('v1.1.0 \u2014 2026-03-20'),
    bulletItem_nyc([richText_nyc('New module: '), richText_nyc('handleReservation.js', { code: true }), richText_nyc(' orchestrator combining parse \u2192 validate \u2192 book flow')]),
    bulletItem_nyc('Added integration test suite (7 tests) covering end-to-end reservation flow'),
    bulletItem_nyc('Documented customer-facing error messages and UX copy guidelines'),

    heading3_nyc('v1.0.0 \u2014 2026-03-15'),
    bulletItem_nyc('Initial release of the reservation system'),
    bulletItem_nyc('Natural language parser supporting ISO dates, month names, US numeric formats'),
    bulletItem_nyc('Mock booking API with availability checking and confirmation ID generation'),
    bulletItem_nyc([richText_nyc('Demo entry point ('), richText_nyc('node src/index.js', { code: true }), richText_nyc(')')]),
    bulletItem_nyc('10 unit tests for parser module'),

    // --- Footer ---
    divider_nyc(),
    paragraph_nyc([
      richText_nyc('Last synced from '),
      richText_nyc('amandalotwin/test', { code: true }),
      richText_nyc(` on ${new Date().toISOString().split('T')[0]}.`),
    ]),
  ];

  return blocks_nyc;
}

// --- Main ---

async function main_nyc() {
  console.log('Building new page content from source files...');
  const blocks_nyc = buildPageBlocks_nyc();
  console.log(`Generated ${blocks_nyc.length} blocks.`);

  console.log('Fetching existing blocks from Notion page...');
  const existingBlocks_nyc = await getChildBlocks_nyc(NOTION_PAGE_ID_nyc);
  console.log(`Found ${existingBlocks_nyc.length} existing blocks. Deleting...`);

  for (const block_nyc of existingBlocks_nyc) {
    await deleteBlock_nyc(block_nyc.id);
  }
  console.log('Existing blocks deleted. Appending new content...');

  await appendChildren_nyc(NOTION_PAGE_ID_nyc, blocks_nyc);
  console.log('Notion page updated successfully!');
}

main_nyc().catch((err_nyc) => {
  console.error('Failed to sync Notion page:', err_nyc.message);
  process.exit(1);
});
