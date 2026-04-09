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

async function notion_request_nyc(endpoint_nyc, method_nyc = 'GET', body_nyc = null) {
  const opts_nyc = { method: method_nyc, headers };
  if (body_nyc) opts_nyc.body = JSON.stringify(body_nyc);
  const res_nyc = await fetch(`${NOTION_API_nyc}${endpoint_nyc}`, opts_nyc);
  if (!res_nyc.ok) {
    const text_nyc = await res_nyc.text();
    throw new Error(`Notion API ${method_nyc} ${endpoint_nyc} failed (${res_nyc.status}): ${text_nyc}`);
  }
  return res_nyc.json();
}

async function get_child_blocks_nyc(block_id_nyc) {
  const blocks_nyc = [];
  let cursor_nyc;
  do {
    const qs_nyc = cursor_nyc ? `?start_cursor=${cursor_nyc}` : '';
    const data_nyc = await notion_request_nyc(`/blocks/${block_id_nyc}/children${qs_nyc}`);
    blocks_nyc.push(...data_nyc.results);
    cursor_nyc = data_nyc.has_more ? data_nyc.next_cursor : null;
  } while (cursor_nyc);
  return blocks_nyc;
}

async function delete_block_nyc(block_id_nyc) {
  return notion_request_nyc(`/blocks/${block_id_nyc}`, 'DELETE');
}

async function append_children_nyc(block_id_nyc, children_nyc) {
  // Notion limits to 100 blocks per request
  for (let i_nyc = 0; i_nyc < children_nyc.length; i_nyc += 100) {
    const batch_nyc = children_nyc.slice(i_nyc, i_nyc + 100);
    await notion_request_nyc(`/blocks/${block_id_nyc}/children`, 'PATCH', { children: batch_nyc });
  }
}

// ─── Notion block builders ───────────────────────────────────────────

function rich_text_nyc(content, opts_nyc = {}) {
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
    heading_1: { rich_text: [rich_text_nyc(text)] },
  };
}

function heading2_nyc(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [rich_text_nyc(text)] },
  };
}

function heading3_nyc(text) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [rich_text_nyc(text)] },
  };
}

function paragraph_nyc(segments_nyc) {
  if (typeof segments_nyc === 'string') segments_nyc = [rich_text_nyc(segments_nyc)];
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: segments_nyc },
  };
}

function bullet_item_nyc(segments_nyc) {
  if (typeof segments_nyc === 'string') segments_nyc = [rich_text_nyc(segments_nyc)];
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: segments_nyc },
  };
}

function code_block_nyc(content, language_nyc = 'javascript') {
  // Notion limits each rich_text segment to 2000 chars
  const MAX_LEN_nyc = 2000;
  const segments_nyc = [];
  for (let i_nyc = 0; i_nyc < content.length; i_nyc += MAX_LEN_nyc) {
    segments_nyc.push(rich_text_nyc(content.slice(i_nyc, i_nyc + MAX_LEN_nyc)));
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

function table_block_nyc(headers, rows) {
  const width_nyc = headers.length;
  const header_row_nyc = {
    object: 'block',
    type: 'table_row',
    table_row: { cells: headers.map((h_nyc) => [rich_text_nyc(h_nyc, { bold: true })]) },
  };
  const data_rows_nyc = rows.map((row_nyc) => ({
    object: 'block',
    type: 'table_row',
    table_row: { cells: row_nyc.map((cell_nyc) => [rich_text_nyc(cell_nyc)]) },
  }));
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: width_nyc,
      has_column_header: true,
      has_row_header: false,
      children: [header_row_nyc, ...data_rows_nyc],
    },
  };
}

function callout_nyc(text, emoji_nyc = 'ℹ️') {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [rich_text_nyc(text)],
      icon: { type: 'emoji', emoji: emoji_nyc },
    },
  };
}

// ─── Read source files ───────────────────────────────────────────────

function read_source_nyc(filename_nyc) {
  const file_path_nyc = path_nyc.resolve(__dirname, '..', 'src', filename_nyc);
  return fs_nyc.readFileSync(file_path_nyc, 'utf-8');
}

// ─── Extract dynamic names from source ──────────────────────────────

function extract_names_nyc(parse_request_src_nyc, mock_api_src_nyc, handle_reservation_src_nyc) {
  // Helper: extract exported names from module.exports = { ... }
  function get_exports_nyc(src_nyc) {
    const m_nyc = src_nyc.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    return m_nyc ? m_nyc[1].split(',').map(function(s_nyc) { return s_nyc.trim(); }).filter(Boolean) : [];
  }

  // Extract function names from exports
  const parse_exports_nyc = get_exports_nyc(parse_request_src_nyc);
  const api_exports_nyc = get_exports_nyc(mock_api_src_nyc);
  const handle_exports_nyc = get_exports_nyc(handle_reservation_src_nyc);

  const parse_fn_nyc = parse_exports_nyc[0] || 'parseRequest';
  const check_avail_fn_nyc = api_exports_nyc.find(function(x_nyc) { return /avail/i.test(x_nyc); }) || 'checkAvailability';
  const make_res_fn_nyc = api_exports_nyc.find(function(x_nyc) { return /reserv/i.test(x_nyc); }) || 'makeReservation';
  const reset_fn_nyc = api_exports_nyc.find(function(x_nyc) { return /reset/i.test(x_nyc); }) || 'resetBookings';
  const handle_fn_nyc = handle_exports_nyc[0] || 'handleReservationRequest';

  // Extract field names from parseRequest return statement
  // Use non-greedy match and limit to first return block (the one inside the main function)
  const return_match_nyc = parse_request_src_nyc.match(/return\s*\{\s*(\w+)\s*:[^,]+,\s*(\w+)\s*:[^,]+,\s*(\w+)\s*:/);
  const date_field_nyc = return_match_nyc ? return_match_nyc[1] : 'date';
  const time_field_nyc = return_match_nyc ? return_match_nyc[2] : 'time';
  const party_size_field_nyc = return_match_nyc ? return_match_nyc[3] : 'partySize';

  // Extract capacity value from mockApi (first const with a number value)
  const capacity_match_nyc = mock_api_src_nyc.match(/const\s+\w+\s*=\s*(\d+)/);
  const capacity_val_nyc = capacity_match_nyc ? capacity_match_nyc[1] : '20';

  // Extract threshold constants from handleReservation
  const const_matches_nyc = Array.from(handle_reservation_src_nyc.matchAll(/const\s+(\w+)\s*=\s*(\d+)\s*;/g));
  let large_party_threshold_nyc = '6';
  let late_night_hour_nyc = '21';
  let happy_hour_start_nyc = '17';
  let happy_hour_end_nyc = '19';
  let brunch_start_nyc = '10';
  let brunch_end_nyc = '13';
  for (const m_nyc of const_matches_nyc) {
    if (/party|threshold/i.test(m_nyc[1])) large_party_threshold_nyc = m_nyc[2];
    else if (/lateNight|late.*night/i.test(m_nyc[1])) late_night_hour_nyc = m_nyc[2];
    else if (/happy_hour_start|happy.*hour.*start/i.test(m_nyc[1])) happy_hour_start_nyc = m_nyc[2];
    else if (/happy_hour_end|happy.*hour.*end/i.test(m_nyc[1])) happy_hour_end_nyc = m_nyc[2];
    else if (/brunch_start/i.test(m_nyc[1])) brunch_start_nyc = m_nyc[2];
    else if (/brunch_end/i.test(m_nyc[1])) brunch_end_nyc = m_nyc[2];
  }

  // Extract response field names from the success return in handleReservation
  // Use brace-depth tracking to correctly handle nested objects and template literals
  let success_field_nyc = 'success';
  let message_field_nyc = 'message';
  let confirmation_field_nyc = 'confirmation';
  let details_field_nyc = 'details';
  let metrics_field_nyc = 'metrics';
  const src_lines_nyc = handle_reservation_src_nyc.split('\n');
  let brace_depth_nyc = 0;
  let in_return_nyc = false;
  let return_block_nyc = '';
  let success_block_nyc = null;
  for (let i_nyc = 0; i_nyc < src_lines_nyc.length; i_nyc++) {
    const line_nyc = src_lines_nyc[i_nyc];
    if (!in_return_nyc && /return\s*\{/.test(line_nyc)) {
      in_return_nyc = true;
      brace_depth_nyc = 0;
      return_block_nyc = '';
    }
    if (in_return_nyc) {
      return_block_nyc += line_nyc + '\n';
      for (const ch_nyc of line_nyc) {
        if (ch_nyc === '{') brace_depth_nyc++;
        if (ch_nyc === '}') brace_depth_nyc--;
      }
      if (brace_depth_nyc <= 0) {
        if (/\w+:\s*true/.test(return_block_nyc)) {
          success_block_nyc = return_block_nyc;
        }
        in_return_nyc = false;
        return_block_nyc = '';
      }
    }
  }
  if (success_block_nyc) {
    // Extract top-level fields using brace depth (handles both 'key:' and shorthand 'key,')
    const block_lines_nyc = success_block_nyc.split('\n');
    let depth_nyc = 0;
    const top_fields_nyc = [];
    for (const fl_nyc of block_lines_nyc) {
      const prev_depth_nyc = depth_nyc;
      for (const ch_nyc of fl_nyc) {
        if (ch_nyc === '{') depth_nyc++;
        if (ch_nyc === '}') depth_nyc--;
      }
      if (prev_depth_nyc === 1 && depth_nyc >= 1) {
        const m_explicit_nyc = fl_nyc.match(/^\s*(\w+)\s*:/);
        const m_shorthand_nyc = fl_nyc.match(/^\s*(\w+)\s*,?\s*$/);
        if (m_explicit_nyc) top_fields_nyc.push(m_explicit_nyc[1]);
        else if (m_shorthand_nyc) top_fields_nyc.push(m_shorthand_nyc[1]);
      }
    }
    if (top_fields_nyc.length >= 2) {
      success_field_nyc = top_fields_nyc[0];
      message_field_nyc = top_fields_nyc[1];
    }
    const cf_nyc = top_fields_nyc.find(function(f_nyc) { return /confirm/i.test(f_nyc); });
    if (cf_nyc) confirmation_field_nyc = cf_nyc;
    const df_nyc = top_fields_nyc.find(function(f_nyc) { return /detail/i.test(f_nyc); });
    if (df_nyc) details_field_nyc = df_nyc;
    const mf_nyc = top_fields_nyc.find(function(f_nyc) { return /metric/i.test(f_nyc); });
    if (mf_nyc) metrics_field_nyc = mf_nyc;
  }

  // Extract metric field names from: metrics_nyc.FIELD = true
  // Use pattern-based matching instead of positional indexing to avoid shifts when new metrics are added
  const metric_matches_nyc = Array.from(handle_reservation_src_nyc.matchAll(/\w+\.(\w+)\s*=\s*true/g)).map(function(m_nyc) { return m_nyc[1]; });
  const large_party_metric_nyc = metric_matches_nyc.find(function(m_nyc) { return /large.*party/i.test(m_nyc); }) || 'largeParty';
  const happy_hour_metric_nyc = metric_matches_nyc.find(function(m_nyc) { return /happy.*hour/i.test(m_nyc); }) || 'happyHour';
  const brunch_metric_nyc = metric_matches_nyc.find(function(m_nyc) { return /brunch/i.test(m_nyc); }) || 'brunch';
  const late_night_metric_nyc = metric_matches_nyc.find(function(m_nyc) { return /late.*night/i.test(m_nyc); }) || 'lateNight';

  // Extract available field from first function return in mockApi
  const avail_return_match_nyc = mock_api_src_nyc.match(/return\s*\{\s*(\w+)\s*\}/);
  const available_field_nyc = avail_return_match_nyc ? avail_return_match_nyc[1] : 'available';

  // Extract confirmation field from second function return in mockApi
  const all_returns_nyc = Array.from(mock_api_src_nyc.matchAll(/return\s*\{\s*(\w+)\s*\}/g));
  const confirm_field_nyc = all_returns_nyc.length > 1 ? all_returns_nyc[1][1] : 'confirmation';

  return {
    parse_fn: parse_fn_nyc,
    check_avail_fn: check_avail_fn_nyc,
    make_res_fn: make_res_fn_nyc,
    reset_fn: reset_fn_nyc,
    handle_fn: handle_fn_nyc,
    date_field: date_field_nyc,
    time_field: time_field_nyc,
    party_size_field: party_size_field_nyc,
    capacity_val: capacity_val_nyc,
    large_party_threshold: large_party_threshold_nyc,
    late_night_hour: late_night_hour_nyc,
    happy_hour_start: happy_hour_start_nyc,
    happy_hour_end: happy_hour_end_nyc,
    brunch_start: brunch_start_nyc,
    brunch_end: brunch_end_nyc,
    success_field: success_field_nyc,
    message_field: message_field_nyc,
    confirmation_field: confirmation_field_nyc,
    details_field: details_field_nyc,
    metrics_field: metrics_field_nyc,
    large_party_metric: large_party_metric_nyc,
    happy_hour_metric: happy_hour_metric_nyc,
    brunch_metric: brunch_metric_nyc,
    late_night_metric: late_night_metric_nyc,
    available_field: available_field_nyc,
    confirm_field: confirm_field_nyc,
  };
}

// --- Build the page content ---

function build_page_blocks_nyc() {
  const parse_request_src_nyc = read_source_nyc('parseRequest.js');
  const mock_api_src_nyc = read_source_nyc('mockApi.js');
  const handle_reservation_src_nyc = read_source_nyc('handleReservation.js');
  const index_src_nyc = read_source_nyc('index.js');

  // Extract all dynamic names from source files
  const n_nyc = extract_names_nyc(parse_request_src_nyc, mock_api_src_nyc, handle_reservation_src_nyc);

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
    code_block_nyc(
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
    table_block_nyc(
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
    paragraph_nyc([rich_text_nyc('File: '), rich_text_nyc('src/parseRequest.js', { code: true })]),

    heading2_nyc(`${n_nyc.parse_fn}(text)`),
    paragraph_nyc('Parses a natural language string and extracts reservation details using regex.'),
    paragraph_nyc([rich_text_nyc('Input: ', { bold: true }), rich_text_nyc('A string like "I\'d like a table for 4 on March 15th at 7pm"')]),
    paragraph_nyc([rich_text_nyc('Output:', { bold: true })]),
    code_block_nyc(`{\n  "${n_nyc.date_field}": "2026-03-15",\n  "${n_nyc.time_field}": "19:00",\n  "${n_nyc.party_size_field}": 4\n}`, 'json'),
    paragraph_nyc('Any field that cannot be extracted returns null.'),

    heading3_nyc('Supported Date Formats'),
    table_block_nyc(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['ISO 8601', '2025-04-10', '2025-04-10'],
        ['Month name + day', 'March 15 or March 15th', 'YYYY-03-15'],
        ['Numeric (US)', '12/25 or 12/25/2026', 'YYYY-12-25'],
      ]
    ),
    paragraph_nyc('When no year is provided, the system infers the next upcoming occurrence of that date.'),

    heading3_nyc('Supported Time Formats'),
    table_block_nyc(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['12-hour with minutes', '6:30 PM', '18:30'],
        ['12-hour without minutes', '7pm', '19:00'],
        ['24-hour', '19:00', '19:00'],
      ]
    ),
    paragraph_nyc('All times are normalized to HH:MM in 24-hour format.'),

    heading3_nyc('Supported Party Size Patterns'),
    table_block_nyc(
      ['Pattern', 'Example Input'],
      [
        ['for X', 'table for 4'],
        ['X people', '2 people'],
        ['party of X', 'party of 8'],
      ]
    ),
    paragraph_nyc('Also recognizes: persons, guests, diners.'),

    heading3_nyc('Source Code'),
    code_block_nyc(parse_request_src_nyc, 'javascript'),
    divider_nyc(),

    // --- Module 2: Booking API ---
    heading1_nyc('Module 2: Booking API'),
    paragraph_nyc([rich_text_nyc('File: '), rich_text_nyc('src/mockApi.js', { code: true })]),
    callout_nyc(
      'To integrate with a real system, replace the functions in this file with calls to your actual database or booking service. Keep the same function signatures and return types.',
      '\uD83D\uDD27'
    ),

    heading2_nyc(`${n_nyc.check_avail_fn}({ ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} })`),
    paragraph_nyc('Checks whether a time slot has room for the requested party.'),
    heading3_nyc('Parameters'),
    table_block_nyc(
      ['Field', 'Type', 'Description'],
      [
        [n_nyc.date_field, 'string', 'Date in YYYY-MM-DD format'],
        [n_nyc.time_field, 'string', 'Time in HH:MM (24-hour) format'],
        [n_nyc.party_size_field, 'number', 'Number of guests'],
      ]
    ),
    paragraph_nyc([rich_text_nyc('Returns: ', { bold: true }), rich_text_nyc(`Promise<{ ${n_nyc.available_field}: boolean }>`)]),
    paragraph_nyc(`A time slot (date + time combination) has a capacity of ${n_nyc.capacity_val} guests. If the total booked guests plus the new party size exceeds ${n_nyc.capacity_val}, the slot is unavailable.`),
    code_block_nyc(
      `const { ${n_nyc.check_avail_fn} } = require('./mockApi');\n\n` +
        `const result_nyc = await ${n_nyc.check_avail_fn}({\n` +
        `  ${n_nyc.date_field}: '2026-12-25',\n` +
        `  ${n_nyc.time_field}: '19:00',\n` +
        `  ${n_nyc.party_size_field}: 4\n` +
        '});\n' +
        `// \u2192 { ${n_nyc.available_field}: true }`,
      'javascript'
    ),

    heading2_nyc(`${n_nyc.make_res_fn}({ ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} })`),
    paragraph_nyc('Creates a reservation and returns a unique confirmation ID.'),
    heading3_nyc('Parameters'),
    table_block_nyc(
      ['Field', 'Type', 'Description'],
      [
        [n_nyc.date_field, 'string', 'Date in YYYY-MM-DD format'],
        [n_nyc.time_field, 'string', 'Time in HH:MM (24-hour) format'],
        [n_nyc.party_size_field, 'number', 'Number of guests'],
      ]
    ),
    paragraph_nyc([rich_text_nyc('Returns: ', { bold: true }), rich_text_nyc(`Promise<{ ${n_nyc.confirm_field}: string }>`)]),
    paragraph_nyc('The confirmation ID follows the format RES-XXXXX (5 random alphanumeric characters).'),
    code_block_nyc(
      `const { ${n_nyc.make_res_fn} } = require('./mockApi');\n\n` +
        `const result_nyc = await ${n_nyc.make_res_fn}({\n` +
        `  ${n_nyc.date_field}: '2026-12-25',\n` +
        `  ${n_nyc.time_field}: '19:00',\n` +
        `  ${n_nyc.party_size_field}: 4\n` +
        '});\n' +
        `// \u2192 { ${n_nyc.confirm_field}: "RES-A3F7K" }`,
      'javascript'
    ),

    heading2_nyc(`${n_nyc.reset_fn}()`),
    paragraph_nyc('Resets the in-memory booking store. Intended for testing use only.'),
    code_block_nyc(
      `const { ${n_nyc.reset_fn} } = require('./mockApi');\n${n_nyc.reset_fn}(); // clears all bookings`,
      'javascript'
    ),

    heading3_nyc('Source Code'),
    code_block_nyc(mock_api_src_nyc, 'javascript'),
    divider_nyc(),

    // --- Module 3: Orchestrator ---
    heading1_nyc('Module 3: Orchestrator'),
    paragraph_nyc([rich_text_nyc('File: '), rich_text_nyc('src/handleReservation.js', { code: true })]),

    heading2_nyc(`${n_nyc.handle_fn}(text)`),
    paragraph_nyc(
      'The main entry point for processing a reservation. Takes a natural language string, parses it, checks availability, and either books the reservation or returns an appropriate error.'
    ),
    paragraph_nyc([rich_text_nyc('Input: ', { bold: true }), rich_text_nyc('string \u2014 a natural language reservation request')]),
    paragraph_nyc([rich_text_nyc('Returns: ', { bold: true }), rich_text_nyc('Promise<object> \u2014 one of three response shapes:')]),

    heading3_nyc('Success Response'),
    code_block_nyc(
      '{\n' +
        `  "${n_nyc.success_field}": true,\n` +
        `  "${n_nyc.message_field}": "Reservation confirmed! Your confirmation number is RES-A3F7K.",\n` +
        `  "${n_nyc.confirmation_field}": "RES-A3F7K",\n` +
        `  "${n_nyc.details_field}": {\n` +
        `    "${n_nyc.date_field}": "2026-12-25",\n` +
        `    "${n_nyc.time_field}": "19:00",\n` +
        `    "${n_nyc.party_size_field}": 8\n` +
        '  },\n' +
        `  "${n_nyc.metrics_field}": {\n` +
        `    "${n_nyc.large_party_metric}": true\n` +
        '  }\n' +
        '}',
      'json'
    ),
    paragraph_nyc([
      rich_text_nyc('The '),
      rich_text_nyc(n_nyc.metrics_field, { code: true }),
      rich_text_nyc(' object is included on all successful responses. Available metrics:'),
    ]),
    bullet_item_nyc([
      rich_text_nyc(n_nyc.large_party_metric, { code: true }),
      rich_text_nyc(': set to '),
      rich_text_nyc('true', { code: true }),
      rich_text_nyc(` when the party size exceeds ${n_nyc.large_party_threshold} guests.`),
    ]),
    bullet_item_nyc([
      rich_text_nyc(n_nyc.happy_hour_metric, { code: true }),
      rich_text_nyc(': set to '),
      rich_text_nyc('true', { code: true }),
      rich_text_nyc(` for reservations between ${n_nyc.happy_hour_start > 12 ? n_nyc.happy_hour_start - 12 : n_nyc.happy_hour_start}\u2013${n_nyc.happy_hour_end > 12 ? n_nyc.happy_hour_end - 12 : n_nyc.happy_hour_end}pm.`),
    ]),
    bullet_item_nyc([
      rich_text_nyc(n_nyc.brunch_metric, { code: true }),
      rich_text_nyc(': set to '),
      rich_text_nyc('true', { code: true }),
      rich_text_nyc(` for reservations between ${n_nyc.brunch_start}am\u2013${n_nyc.brunch_end > 12 ? n_nyc.brunch_end - 12 : n_nyc.brunch_end}pm.`),
    ]),
    bullet_item_nyc([
      rich_text_nyc(n_nyc.late_night_metric, { code: true }),
      rich_text_nyc(': set to '),
      rich_text_nyc('true', { code: true }),
      rich_text_nyc(` when the reservation hour is ${n_nyc.late_night_hour}:00 or later.`),
    ]),

    heading3_nyc('Parsing Failure (missing date, time, or party size)'),
    code_block_nyc(
      '{\n' +
        `  "${n_nyc.success_field}": false,\n` +
        `  "${n_nyc.message_field}": "Could not understand your reservation request. Please include a date, time, and party size."\n` +
        '}',
      'json'
    ),

    heading3_nyc('Unavailable Slot'),
    code_block_nyc(
      '{\n' +
        `  "${n_nyc.success_field}": false,\n` +
        `  "${n_nyc.message_field}": "Sorry, that time slot is not available. Please try a different date or time."\n` +
        '}',
      'json'
    ),

    heading3_nyc('Flow'),
    code_block_nyc(
      'Input text\n' +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${n_nyc.parse_fn}(text)\n` +
        '    \u2502\n' +
        '    \u251C\u2500\u2500 Any field is null? \u2192 Return parsing error\n' +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${n_nyc.check_avail_fn}({ ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} })\n` +
        '    \u2502\n' +
        `    \u251C\u2500\u2500 ${n_nyc.available_field}: false \u2192 Return unavailable error\n` +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${n_nyc.make_res_fn}({ ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} })\n` +
        '    \u2502\n' +
        '    \u25BC\n' +
        'Return success with confirmation ID and details',
      'plain text'
    ),

    heading3_nyc('Source Code'),
    code_block_nyc(handle_reservation_src_nyc, 'javascript'),
    divider_nyc(),

    // --- Integration Guide ---
    heading1_nyc('Integration Guide'),

    heading2_nyc('Step 1: Install'),
    code_block_nyc('npm install', 'bash'),

    heading2_nyc('Step 2: Try the Demo'),
    code_block_nyc('node src/index.js', 'bash'),

    heading2_nyc('Step 3: Use in Your Application'),
    code_block_nyc(
      `const { ${n_nyc.handle_fn} } = require('./src/handleReservation');\n\n` +
        '// From your chatbot, web form, SMS handler, etc.\n' +
        'const user_input_nyc = "Table for 4 on December 25th at 7pm";\n' +
        `const result_nyc = await ${n_nyc.handle_fn}(user_input_nyc);\n\n` +
        `if (result_nyc.${n_nyc.success_field}) {\n` +
        `  console.log(result_nyc.${n_nyc.message_field});       // "Reservation confirmed! ..."\n` +
        `  console.log(result_nyc.${n_nyc.confirmation_field});   // "RES-A3F7K"\n` +
        `  console.log(result_nyc.${n_nyc.details_field});       // { ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} }\n` +
        '} else {\n' +
        `  console.log(result_nyc.${n_nyc.message_field});\n` +
        '}',
      'javascript'
    ),

    heading2_nyc('Step 4: Connect to Your Real Database'),
    paragraph_nyc([
      rich_text_nyc('Replace the functions in '),
      rich_text_nyc('src/mockApi.js', { code: true }),
      rich_text_nyc(' with your own implementations. The contract to maintain:'),
    ]),
    table_block_nyc(
      ['Function', 'Must Accept', 'Must Return'],
      [
        [n_nyc.check_avail_fn, `{ ${n_nyc.date_field}: string, ${n_nyc.time_field}: string, ${n_nyc.party_size_field}: number }`, `Promise<{ ${n_nyc.available_field}: boolean }>`],
        [n_nyc.make_res_fn, `{ ${n_nyc.date_field}: string, ${n_nyc.time_field}: string, ${n_nyc.party_size_field}: number }`, `Promise<{ ${n_nyc.confirm_field}: string }>`],
      ]
    ),
    paragraph_nyc('Example with a SQL database:'),
    code_block_nyc(
      `async function ${n_nyc.check_avail_fn}({ ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} }) {\n` +
        '  const row_nyc = await db.query(\n' +
        "    'SELECT SUM(party_size) AS total FROM reservations WHERE date = ? AND time = ?',\n" +
        `    [${n_nyc.date_field}, ${n_nyc.time_field}]\n` +
        '  );\n' +
        '  const current_count_nyc = row_nyc.total || 0;\n' +
        `  return { ${n_nyc.available_field}: current_count_nyc + ${n_nyc.party_size_field} <= YOUR_CAPACITY };\n` +
        '}\n\n' +
        `async function ${n_nyc.make_res_fn}({ ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field} }) {\n` +
        '  const confirmation_nyc = generateUniqueId();\n' +
        '  await db.query(\n' +
        "    'INSERT INTO reservations (confirmation, date, time, party_size) VALUES (?, ?, ?, ?)',\n" +
        `    [confirmation_nyc, ${n_nyc.date_field}, ${n_nyc.time_field}, ${n_nyc.party_size_field}]\n` +
        '  );\n' +
        `  return { ${n_nyc.confirm_field}: confirmation_nyc };\n` +
        '}',
      'javascript'
    ),
    divider_nyc(),

    // --- Testing ---
    heading1_nyc('Testing'),
    paragraph_nyc('Run all 17 tests:'),
    code_block_nyc('npm test', 'bash'),
    table_block_nyc(
      ['Test Suite', 'Count', 'What It Covers'],
      [
        ['parseRequest.test.js', '10', 'Date formats, time formats, party size patterns, edge cases, unparseable input'],
        ['handleReservation.test.js', '7', 'Successful booking, capacity exhaustion, incomplete input, missing fields, state reset'],
      ]
    ),
    divider_nyc(),

    // --- Data Formats Reference ---
    heading1_nyc('Data Formats Reference'),
    table_block_nyc(
      ['Field', 'Format', 'Example'],
      [
        [n_nyc.date_field, 'YYYY-MM-DD', '2026-12-25'],
        [n_nyc.time_field, 'HH:MM (24-hour)', '19:00'],
        [n_nyc.party_size_field, 'Integer', '4'],
        [n_nyc.confirmation_field, 'RES-XXXXX', 'RES-A3F7K'],
      ]
    ),
    divider_nyc(),

    // --- Configuration ---
    heading1_nyc('Configuration'),
    table_block_nyc(
      ['Setting', 'Current Value', 'Location', 'Description'],
      [
        ['Slot capacity', `${n_nyc.capacity_val} guests`, 'src/mockApi.js line 1', 'Maximum total guests per date+time slot'],
      ]
    ),
    paragraph_nyc(
      'To change the capacity, update the capacity constant in mockApi.js, or move it to a config file / environment variable for production use.'
    ),
    divider_nyc(),

    // --- Demo Entry Point ---
    heading1_nyc('Demo Entry Point'),
    paragraph_nyc([rich_text_nyc('File: '), rich_text_nyc('src/index.js', { code: true })]),
    code_block_nyc(index_src_nyc, 'javascript'),

    // --- Change Log ---
    heading1_nyc('Change Log'),
    callout_nyc(
      'This section tracks all changes to the reservation system.',
      '\uD83D\uDCCB'
    ),

    heading3_nyc('v1.4.0 \u2014 2026-04-08'),
    bullet_item_nyc('Auto-synced Notion design spec with update system'),
    bullet_item_nyc('Added change analysis pipeline (analyze-changes.js)'),
    bullet_item_nyc('Added review draft generator for proposed documentation updates'),

    heading3_nyc('v1.3.0 \u2014 2026-04-05'),
    bullet_item_nyc('Added support for "diners" keyword in party size parsing'),
    bullet_item_nyc([rich_text_nyc('Renamed internal helper '), rich_text_nyc('formatDateString', { code: true }), rich_text_nyc(' \u2192 '), rich_text_nyc('formatDate', { code: true })]),
    bullet_item_nyc('Evaluated migration from in-memory store to SQLite \u2014 deferred to v2.0'),

    heading3_nyc('v1.2.0 \u2014 2026-03-28'),
    bullet_item_nyc('capacity constant updated from 15 \u2192 20 guests per slot'),
    bullet_item_nyc([rich_text_nyc('Added '), rich_text_nyc('resetBookings()', { code: true }), rich_text_nyc(' helper for test isolation')]),
    bullet_item_nyc('Fixed 24-hour time parsing fallback for ambiguous formats like 6:30'),

    heading3_nyc('v1.1.0 \u2014 2026-03-20'),
    bullet_item_nyc([rich_text_nyc('New module: '), rich_text_nyc('handleReservation.js', { code: true }), rich_text_nyc(' orchestrator combining parse \u2192 validate \u2192 book flow')]),
    bullet_item_nyc('Added integration test suite (7 tests) covering end-to-end reservation flow'),
    bullet_item_nyc('Documented customer-facing error messages and UX copy guidelines'),

    heading3_nyc('v1.0.0 \u2014 2026-03-15'),
    bullet_item_nyc('Initial release of the reservation system'),
    bullet_item_nyc('Natural language parser supporting ISO dates, month names, US numeric formats'),
    bullet_item_nyc('Mock booking API with availability checking and confirmation ID generation'),
    bullet_item_nyc([rich_text_nyc('Demo entry point ('), rich_text_nyc('node src/index.js', { code: true }), rich_text_nyc(')')]),
    bullet_item_nyc('10 unit tests for parser module'),

    // --- Footer ---
    divider_nyc(),
    paragraph_nyc([
      rich_text_nyc('Last synced from '),
      rich_text_nyc('amandalotwin/test', { code: true }),
      rich_text_nyc(` on ${new Date().toISOString().split('T')[0]}.`),
    ]),
  ];

  return blocks_nyc;
}

// --- Main ---

async function main_nyc() {
  console.log('Building new page content from source files...');
  const blocks_nyc = build_page_blocks_nyc();
  console.log(`Generated ${blocks_nyc.length} blocks.`);

  console.log('Fetching existing blocks from Notion page...');
  const existing_blocks_nyc = await get_child_blocks_nyc(NOTION_PAGE_ID_nyc);
  console.log(`Found ${existing_blocks_nyc.length} existing blocks. Deleting...`);

  for (const block_nyc of existing_blocks_nyc) {
    await delete_block_nyc(block_nyc.id);
  }
  console.log('Existing blocks deleted. Appending new content...');

  await append_children_nyc(NOTION_PAGE_ID_nyc, blocks_nyc);
  console.log('Notion page updated successfully!');
}

main_nyc().catch((err_nyc) => {
  console.error('Failed to sync Notion page:', err_nyc.message);
  process.exit(1);
});
