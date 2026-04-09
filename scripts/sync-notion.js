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

const FS_NYC = require('fs');
const PATH_NYC = require('path');

const NOTION_API_NYC = 'https://api.notion.com/v1';
const NOTION_VERSION_NYC = '2022-06-28';

const NOTION_TOKEN_NYC = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID_NYC = process.env.NOTION_PAGE_ID;

if (!NOTION_TOKEN_NYC || !NOTION_PAGE_ID_NYC) {
  console.error('Missing NOTION_TOKEN or NOTION_PAGE_ID environment variables.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN_NYC}`,
  'Notion-Version': NOTION_VERSION_NYC,
  'Content-Type': 'application/json',
};

// ─── Notion API helpers ───────────────────────────────────────────────

async function NOTIONREQUEST_NYC(ENDPOINT_NYC, METHOD_NYC = 'GET', BODY_NYC = null) {
  const OPTS_NYC = { method: METHOD_NYC, headers };
  if (BODY_NYC) OPTS_NYC.body = JSON.stringify(BODY_NYC);
  const RES_NYC = await fetch(`${NOTION_API_NYC}${ENDPOINT_NYC}`, OPTS_NYC);
  if (!RES_NYC.ok) {
    const TEXT_NYC = await RES_NYC.text();
    throw new Error(`Notion API ${METHOD_NYC} ${ENDPOINT_NYC} failed (${RES_NYC.status}): ${TEXT_NYC}`);
  }
  return RES_NYC.json();
}

async function GETCHILDBLOCKS_NYC(BLOCKID_NYC) {
  const BLOCKS_NYC = [];
  let CURSOR_NYC;
  do {
    const QS_NYC = CURSOR_NYC ? `?start_cursor=${CURSOR_NYC}` : '';
    const DATA_NYC = await NOTIONREQUEST_NYC(`/blocks/${BLOCKID_NYC}/children${QS_NYC}`);
    BLOCKS_NYC.push(...DATA_NYC.results);
    CURSOR_NYC = DATA_NYC.has_more ? DATA_NYC.next_cursor : null;
  } while (CURSOR_NYC);
  return BLOCKS_NYC;
}

async function DELETEBLOCK_NYC(BLOCKID_NYC) {
  return NOTIONREQUEST_NYC(`/blocks/${BLOCKID_NYC}`, 'DELETE');
}

async function APPENDCHILDREN_NYC(BLOCKID_NYC, CHILDREN_NYC) {
  // Notion limits to 100 blocks per request
  for (let I_NYC = 0; I_NYC < CHILDREN_NYC.length; I_NYC += 100) {
    const BATCH_NYC = CHILDREN_NYC.slice(I_NYC, I_NYC + 100);
    await NOTIONREQUEST_NYC(`/blocks/${BLOCKID_NYC}/children`, 'PATCH', { children: BATCH_NYC });
  }
}

// ─── Notion block builders ───────────────────────────────────────────

function RICHTEXT_NYC(content, OPTS_NYC = {}) {
  const TEXT_NYC = { content };
  if (OPTS_NYC.link) TEXT_NYC.link = { url: OPTS_NYC.link };
  const ANNOTATIONS_NYC = {};
  if (OPTS_NYC.bold) ANNOTATIONS_NYC.bold = true;
  if (OPTS_NYC.italic) ANNOTATIONS_NYC.italic = true;
  if (OPTS_NYC.code) ANNOTATIONS_NYC.code = true;
  return { type: 'text', text: TEXT_NYC, ...(Object.keys(ANNOTATIONS_NYC).length ? { annotations: ANNOTATIONS_NYC } : {}) };
}

function HEADING1_NYC(text) {
  return {
    object: 'block',
    type: 'heading_1',
    heading_1: { rich_text: [RICHTEXT_NYC(text)] },
  };
}

function HEADING2_NYC(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [RICHTEXT_NYC(text)] },
  };
}

function HEADING3_NYC(text) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [RICHTEXT_NYC(text)] },
  };
}

function PARAGRAPH_NYC(SEGMENTS_NYC) {
  if (typeof SEGMENTS_NYC === 'string') SEGMENTS_NYC = [RICHTEXT_NYC(SEGMENTS_NYC)];
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: SEGMENTS_NYC },
  };
}

function BULLETITEM_NYC(SEGMENTS_NYC) {
  if (typeof SEGMENTS_NYC === 'string') SEGMENTS_NYC = [RICHTEXT_NYC(SEGMENTS_NYC)];
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: SEGMENTS_NYC },
  };
}

function CODEBLOCK_NYC(content, LANGUAGE_NYC = 'javascript') {
  // Notion limits each rich_text segment to 2000 chars
  const MAX_LEN_NYC = 2000;
  const SEGMENTS_NYC = [];
  for (let I_NYC = 0; I_NYC < content.length; I_NYC += MAX_LEN_NYC) {
    SEGMENTS_NYC.push(RICHTEXT_NYC(content.slice(I_NYC, I_NYC + MAX_LEN_NYC)));
  }
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: SEGMENTS_NYC,
      language: LANGUAGE_NYC,
    },
  };
}

function DIVIDER_NYC() {
  return { object: 'block', type: 'divider', divider: {} };
}

function TABLEBLOCK_NYC(headers, rows) {
  const WIDTH_NYC = headers.length;
  const HEADERROW_NYC = {
    object: 'block',
    type: 'table_row',
    table_row: { cells: headers.map((H_NYC) => [RICHTEXT_NYC(H_NYC, { bold: true })]) },
  };
  const DATAROWS_NYC = rows.map((ROW_NYC) => ({
    object: 'block',
    type: 'table_row',
    table_row: { cells: ROW_NYC.map((CELL_NYC) => [RICHTEXT_NYC(CELL_NYC)]) },
  }));
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: WIDTH_NYC,
      has_column_header: true,
      has_row_header: false,
      children: [HEADERROW_NYC, ...DATAROWS_NYC],
    },
  };
}

function CALLOUT_NYC(text, EMOJI_NYC = 'ℹ️') {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [RICHTEXT_NYC(text)],
      icon: { type: 'emoji', emoji: EMOJI_NYC },
    },
  };
}

// ─── Read source files ───────────────────────────────────────────────

function READSOURCE_NYC(FILENAME_NYC) {
  const FILEPATH_NYC = PATH_NYC.resolve(__dirname, '..', 'src', FILENAME_NYC);
  return FS_NYC.readFileSync(FILEPATH_NYC, 'utf-8');
}

// ─── Extract dynamic names from source ──────────────────────────────

function EXTRACTNAMES_NYC(PARSEREQUESTSRC_NYC, MOCKAPISRC_NYC, HANDLERESERVATIONSRC_NYC) {
  // Helper: extract exported names from module.exports = { ... }
  function GETEXPORTS_NYC(SRC_NYC) {
    const M_NYC = SRC_NYC.match(/module\.exports\s*=\s*\{([^}]+)\}/);
    return M_NYC ? M_NYC[1].split(',').map(function(S_NYC) { return S_NYC.trim(); }).filter(Boolean) : [];
  }

  // Extract function names from exports
  const PARSEEXPORTS_NYC = GETEXPORTS_NYC(PARSEREQUESTSRC_NYC);
  const APIEXPORTS_NYC = GETEXPORTS_NYC(MOCKAPISRC_NYC);
  const HANDLEEXPORTS_NYC = GETEXPORTS_NYC(HANDLERESERVATIONSRC_NYC);

  const PARSEFN_NYC = PARSEEXPORTS_NYC[0] || 'parseRequest';
  const CHECKAVAILFN_NYC = APIEXPORTS_NYC.find(function(X_NYC) { return /avail/i.test(X_NYC); }) || 'checkAvailability';
  const MAKERESFN_NYC = APIEXPORTS_NYC.find(function(X_NYC) { return /reserv/i.test(X_NYC); }) || 'makeReservation';
  const RESETFN_NYC = APIEXPORTS_NYC.find(function(X_NYC) { return /reset/i.test(X_NYC); }) || 'resetBookings';
  const HANDLEFN_NYC = HANDLEEXPORTS_NYC[0] || 'handleReservationRequest';

  // Extract field names from parseRequest return statement
  // Use non-greedy match and limit to first return block (the one inside the main function)
  const RETURNMATCH_NYC = PARSEREQUESTSRC_NYC.match(/return\s*\{\s*(\w+)\s*:[^,]+,\s*(\w+)\s*:[^,]+,\s*(\w+)\s*:/);
  const DATEFIELD_NYC = RETURNMATCH_NYC ? RETURNMATCH_NYC[1] : 'date';
  const TIMEFIELD_NYC = RETURNMATCH_NYC ? RETURNMATCH_NYC[2] : 'time';
  const PARTYSIZEFIELD_NYC = RETURNMATCH_NYC ? RETURNMATCH_NYC[3] : 'partySize';

  // Extract capacity value from mockApi (first const with a number value)
  const CAPACITYMATCH_NYC = MOCKAPISRC_NYC.match(/const\s+\w+\s*=\s*(\d+)/);
  const CAPACITYVAL_NYC = CAPACITYMATCH_NYC ? CAPACITYMATCH_NYC[1] : '20';

  // Extract threshold constants from handleReservation
  const CONSTMATCHES_NYC = Array.from(HANDLERESERVATIONSRC_NYC.matchAll(/const\s+(\w+)\s*=\s*(\d+)\s*;/g));
  let LARGEPARTYTHRESHOLD_NYC = '6';
  let LATENIGHTHOUR_NYC = '21';
  let HAPPYHOURSTART_NYC = '17';
  let HAPPYHOUREND_NYC = '19';
  let BRUNCHSTART_NYC = '10';
  let BRUNCHEND_NYC = '13';
  for (const M_NYC of CONSTMATCHES_NYC) {
    if (/party|threshold/i.test(M_NYC[1])) LARGEPARTYTHRESHOLD_NYC = M_NYC[2];
    else if (/lateNight|late.*night/i.test(M_NYC[1])) LATENIGHTHOUR_NYC = M_NYC[2];
    else if (/happyHourStart|happy.*hour.*start/i.test(M_NYC[1])) HAPPYHOURSTART_NYC = M_NYC[2];
    else if (/happyHourEnd|happy.*hour.*end/i.test(M_NYC[1])) HAPPYHOUREND_NYC = M_NYC[2];
    else if (/brunchStart/i.test(M_NYC[1])) BRUNCHSTART_NYC = M_NYC[2];
    else if (/brunchEnd/i.test(M_NYC[1])) BRUNCHEND_NYC = M_NYC[2];
  }

  // Extract response field names from the success return in handleReservation
  // Use brace-depth tracking to correctly handle nested objects and template literals
  let SUCCESSFIELD_NYC = 'success';
  let MESSAGEFIELD_NYC = 'message';
  let CONFIRMATIONFIELD_NYC = 'confirmation';
  let DETAILSFIELD_NYC = 'details';
  let METRICSFIELD_NYC = 'metrics';
  const SRCLINES_NYC = HANDLERESERVATIONSRC_NYC.split('\n');
  let BRACEDEPTH_NYC = 0;
  let INRETURN_NYC = false;
  let RETURNBLOCK_NYC = '';
  let SUCCESSBLOCK_NYC = null;
  for (let I_NYC = 0; I_NYC < SRCLINES_NYC.length; I_NYC++) {
    const LINE_NYC = SRCLINES_NYC[I_NYC];
    if (!INRETURN_NYC && /return\s*\{/.test(LINE_NYC)) {
      INRETURN_NYC = true;
      BRACEDEPTH_NYC = 0;
      RETURNBLOCK_NYC = '';
    }
    if (INRETURN_NYC) {
      RETURNBLOCK_NYC += LINE_NYC + '\n';
      for (const CH_NYC of LINE_NYC) {
        if (CH_NYC === '{') BRACEDEPTH_NYC++;
        if (CH_NYC === '}') BRACEDEPTH_NYC--;
      }
      if (BRACEDEPTH_NYC <= 0) {
        if (/\w+:\s*true/.test(RETURNBLOCK_NYC)) {
          SUCCESSBLOCK_NYC = RETURNBLOCK_NYC;
        }
        INRETURN_NYC = false;
        RETURNBLOCK_NYC = '';
      }
    }
  }
  if (SUCCESSBLOCK_NYC) {
    // Extract top-level fields using brace depth (handles both 'key:' and shorthand 'key,')
    const BLOCKLINES_NYC = SUCCESSBLOCK_NYC.split('\n');
    let DEPTH_NYC = 0;
    const TOPFIELDS_NYC = [];
    for (const FL_NYC of BLOCKLINES_NYC) {
      const PREVDEPTH_NYC = DEPTH_NYC;
      for (const CH_NYC of FL_NYC) {
        if (CH_NYC === '{') DEPTH_NYC++;
        if (CH_NYC === '}') DEPTH_NYC--;
      }
      if (PREVDEPTH_NYC === 1 && DEPTH_NYC >= 1) {
        const MEXPLICIT_NYC = FL_NYC.match(/^\s*(\w+)\s*:/);
        const MSHORTHAND_NYC = FL_NYC.match(/^\s*(\w+)\s*,?\s*$/);
        if (MEXPLICIT_NYC) TOPFIELDS_NYC.push(MEXPLICIT_NYC[1]);
        else if (MSHORTHAND_NYC) TOPFIELDS_NYC.push(MSHORTHAND_NYC[1]);
      }
    }
    if (TOPFIELDS_NYC.length >= 2) {
      SUCCESSFIELD_NYC = TOPFIELDS_NYC[0];
      MESSAGEFIELD_NYC = TOPFIELDS_NYC[1];
    }
    const CF_NYC = TOPFIELDS_NYC.find(function(F_NYC) { return /confirm/i.test(F_NYC); });
    if (CF_NYC) CONFIRMATIONFIELD_NYC = CF_NYC;
    const DF_NYC = TOPFIELDS_NYC.find(function(F_NYC) { return /detail/i.test(F_NYC); });
    if (DF_NYC) DETAILSFIELD_NYC = DF_NYC;
    const MF_NYC = TOPFIELDS_NYC.find(function(F_NYC) { return /metric/i.test(F_NYC); });
    if (MF_NYC) METRICSFIELD_NYC = MF_NYC;
  }

  // Extract metric field names from: METRICS_NYC.FIELD = true
  // Use pattern-based matching instead of positional indexing to avoid shifts when new metrics are added
  const METRICMATCHES_NYC = Array.from(HANDLERESERVATIONSRC_NYC.matchAll(/\w+\.(\w+)\s*=\s*true/g)).map(function(M_NYC) { return M_NYC[1]; });
  const LARGEPARTYMETRIC_NYC = METRICMATCHES_NYC.find(function(M_NYC) { return /large.*party/i.test(M_NYC); }) || 'largeParty';
  const HAPPYHOURMETRIC_NYC = METRICMATCHES_NYC.find(function(M_NYC) { return /happy.*hour/i.test(M_NYC); }) || 'happyHour';
  const BRUNCHMETRIC_NYC = METRICMATCHES_NYC.find(function(M_NYC) { return /brunch/i.test(M_NYC); }) || 'brunch';
  const LATENIGHTMETRIC_NYC = METRICMATCHES_NYC.find(function(M_NYC) { return /late.*night/i.test(M_NYC); }) || 'lateNight';

  // Extract available field from first function return in mockApi
  const AVAILRETURNMATCH_NYC = MOCKAPISRC_NYC.match(/return\s*\{\s*(\w+)\s*\}/);
  const AVAILABLEFIELD_NYC = AVAILRETURNMATCH_NYC ? AVAILRETURNMATCH_NYC[1] : 'available';

  // Extract confirmation field from second function return in mockApi
  const ALLRETURNS_NYC = Array.from(MOCKAPISRC_NYC.matchAll(/return\s*\{\s*(\w+)\s*\}/g));
  const CONFIRMFIELD_NYC = ALLRETURNS_NYC.length > 1 ? ALLRETURNS_NYC[1][1] : 'confirmation';

  return {
    parseFn: PARSEFN_NYC,
    checkAvailFn: CHECKAVAILFN_NYC,
    makeResFn: MAKERESFN_NYC,
    resetFn: RESETFN_NYC,
    handleFn: HANDLEFN_NYC,
    dateField: DATEFIELD_NYC,
    timeField: TIMEFIELD_NYC,
    partySizeField: PARTYSIZEFIELD_NYC,
    capacityVal: CAPACITYVAL_NYC,
    largePartyThreshold: LARGEPARTYTHRESHOLD_NYC,
    lateNightHour: LATENIGHTHOUR_NYC,
    happyHourStart: HAPPYHOURSTART_NYC,
    happyHourEnd: HAPPYHOUREND_NYC,
    brunchStart: BRUNCHSTART_NYC,
    brunchEnd: BRUNCHEND_NYC,
    successField: SUCCESSFIELD_NYC,
    messageField: MESSAGEFIELD_NYC,
    confirmationField: CONFIRMATIONFIELD_NYC,
    detailsField: DETAILSFIELD_NYC,
    metricsField: METRICSFIELD_NYC,
    largePartyMetric: LARGEPARTYMETRIC_NYC,
    happyHourMetric: HAPPYHOURMETRIC_NYC,
    brunchMetric: BRUNCHMETRIC_NYC,
    lateNightMetric: LATENIGHTMETRIC_NYC,
    availableField: AVAILABLEFIELD_NYC,
    confirmField: CONFIRMFIELD_NYC,
  };
}

// --- Build the page content ---

function BUILDPAGEBLOCKS_NYC() {
  const PARSEREQUESTSRC_NYC = READSOURCE_NYC('parseRequest.js');
  const MOCKAPISRC_NYC = READSOURCE_NYC('mockApi.js');
  const HANDLERESERVATIONSRC_NYC = READSOURCE_NYC('handleReservation.js');
  const INDEXSRC_NYC = READSOURCE_NYC('index.js');

  // Extract all dynamic names from source files
  const N_NYC = EXTRACTNAMES_NYC(PARSEREQUESTSRC_NYC, MOCKAPISRC_NYC, HANDLERESERVATIONSRC_NYC);

  const BLOCKS_NYC = [
    // --- Overview ---
    HEADING1_NYC('Overview'),
    PARAGRAPH_NYC(
      'The Reservation System is a lightweight Node.js module that allows any restaurant to accept reservations through natural language input. It parses human-readable requests, checks table availability, and books the reservation \u2014 all through a simple JavaScript API.'
    ),
    CALLOUT_NYC(
      'This system is designed to be integrated into any restaurant\'s existing tech stack. Replace the mock API layer (mockApi.js) with calls to your own database or booking service to go live.',
      '\uD83D\uDD0C'
    ),
    DIVIDER_NYC(),

    // --- Architecture ---
    HEADING1_NYC('Architecture'),
    CODEBLOCK_NYC(
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

    HEADING2_NYC('File Structure'),
    TABLEBLOCK_NYC(
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
    DIVIDER_NYC(),

    // --- Module 1: Parser ---
    HEADING1_NYC('Module 1: Natural Language Parser'),
    PARAGRAPH_NYC([RICHTEXT_NYC('File: '), RICHTEXT_NYC('src/parseRequest.js', { code: true })]),

    HEADING2_NYC(`${N_NYC.parseFn}(text)`),
    PARAGRAPH_NYC('Parses a natural language string and extracts reservation details using regex.'),
    PARAGRAPH_NYC([RICHTEXT_NYC('Input: ', { bold: true }), RICHTEXT_NYC('A string like "I\'d like a table for 4 on March 15th at 7pm"')]),
    PARAGRAPH_NYC([RICHTEXT_NYC('Output:', { bold: true })]),
    CODEBLOCK_NYC(`{\n  "${N_NYC.dateField}": "2026-03-15",\n  "${N_NYC.timeField}": "19:00",\n  "${N_NYC.partySizeField}": 4\n}`, 'json'),
    PARAGRAPH_NYC('Any field that cannot be extracted returns null.'),

    HEADING3_NYC('Supported Date Formats'),
    TABLEBLOCK_NYC(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['ISO 8601', '2025-04-10', '2025-04-10'],
        ['Month name + day', 'March 15 or March 15th', 'YYYY-03-15'],
        ['Numeric (US)', '12/25 or 12/25/2026', 'YYYY-12-25'],
      ]
    ),
    PARAGRAPH_NYC('When no year is provided, the system infers the next upcoming occurrence of that date.'),

    HEADING3_NYC('Supported Time Formats'),
    TABLEBLOCK_NYC(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['12-hour with minutes', '6:30 PM', '18:30'],
        ['12-hour without minutes', '7pm', '19:00'],
        ['24-hour', '19:00', '19:00'],
      ]
    ),
    PARAGRAPH_NYC('All times are normalized to HH:MM in 24-hour format.'),

    HEADING3_NYC('Supported Party Size Patterns'),
    TABLEBLOCK_NYC(
      ['Pattern', 'Example Input'],
      [
        ['for X', 'table for 4'],
        ['X people', '2 people'],
        ['party of X', 'party of 8'],
      ]
    ),
    PARAGRAPH_NYC('Also recognizes: persons, guests, diners.'),

    HEADING3_NYC('Source Code'),
    CODEBLOCK_NYC(PARSEREQUESTSRC_NYC, 'javascript'),
    DIVIDER_NYC(),

    // --- Module 2: Booking API ---
    HEADING1_NYC('Module 2: Booking API'),
    PARAGRAPH_NYC([RICHTEXT_NYC('File: '), RICHTEXT_NYC('src/mockApi.js', { code: true })]),
    CALLOUT_NYC(
      'To integrate with a real system, replace the functions in this file with calls to your actual database or booking service. Keep the same function signatures and return types.',
      '\uD83D\uDD27'
    ),

    HEADING2_NYC(`${N_NYC.checkAvailFn}({ ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} })`),
    PARAGRAPH_NYC('Checks whether a time slot has room for the requested party.'),
    HEADING3_NYC('Parameters'),
    TABLEBLOCK_NYC(
      ['Field', 'Type', 'Description'],
      [
        [N_NYC.dateField, 'string', 'Date in YYYY-MM-DD format'],
        [N_NYC.timeField, 'string', 'Time in HH:MM (24-hour) format'],
        [N_NYC.partySizeField, 'number', 'Number of guests'],
      ]
    ),
    PARAGRAPH_NYC([RICHTEXT_NYC('Returns: ', { bold: true }), RICHTEXT_NYC(`Promise<{ ${N_NYC.availableField}: boolean }>`)]),
    PARAGRAPH_NYC(`A time slot (date + time combination) has a capacity of ${N_NYC.capacityVal} guests. If the total booked guests plus the new party size exceeds ${N_NYC.capacityVal}, the slot is unavailable.`),
    CODEBLOCK_NYC(
      `const { ${N_NYC.checkAvailFn} } = require('./mockApi');\n\n` +
        `const RESULT_NYC = await ${N_NYC.checkAvailFn}({\n` +
        `  ${N_NYC.dateField}: '2026-12-25',\n` +
        `  ${N_NYC.timeField}: '19:00',\n` +
        `  ${N_NYC.partySizeField}: 4\n` +
        '});\n' +
        `// \u2192 { ${N_NYC.availableField}: true }`,
      'javascript'
    ),

    HEADING2_NYC(`${N_NYC.makeResFn}({ ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} })`),
    PARAGRAPH_NYC('Creates a reservation and returns a unique confirmation ID.'),
    HEADING3_NYC('Parameters'),
    TABLEBLOCK_NYC(
      ['Field', 'Type', 'Description'],
      [
        [N_NYC.dateField, 'string', 'Date in YYYY-MM-DD format'],
        [N_NYC.timeField, 'string', 'Time in HH:MM (24-hour) format'],
        [N_NYC.partySizeField, 'number', 'Number of guests'],
      ]
    ),
    PARAGRAPH_NYC([RICHTEXT_NYC('Returns: ', { bold: true }), RICHTEXT_NYC(`Promise<{ ${N_NYC.confirmField}: string }>`)]),
    PARAGRAPH_NYC('The confirmation ID follows the format RES-XXXXX (5 random alphanumeric characters).'),
    CODEBLOCK_NYC(
      `const { ${N_NYC.makeResFn} } = require('./mockApi');\n\n` +
        `const RESULT_NYC = await ${N_NYC.makeResFn}({\n` +
        `  ${N_NYC.dateField}: '2026-12-25',\n` +
        `  ${N_NYC.timeField}: '19:00',\n` +
        `  ${N_NYC.partySizeField}: 4\n` +
        '});\n' +
        `// \u2192 { ${N_NYC.confirmField}: "RES-A3F7K" }`,
      'javascript'
    ),

    HEADING2_NYC(`${N_NYC.resetFn}()`),
    PARAGRAPH_NYC('Resets the in-memory booking store. Intended for testing use only.'),
    CODEBLOCK_NYC(
      `const { ${N_NYC.resetFn} } = require('./mockApi');\n${N_NYC.resetFn}(); // clears all bookings`,
      'javascript'
    ),

    HEADING3_NYC('Source Code'),
    CODEBLOCK_NYC(MOCKAPISRC_NYC, 'javascript'),
    DIVIDER_NYC(),

    // --- Module 3: Orchestrator ---
    HEADING1_NYC('Module 3: Orchestrator'),
    PARAGRAPH_NYC([RICHTEXT_NYC('File: '), RICHTEXT_NYC('src/handleReservation.js', { code: true })]),

    HEADING2_NYC(`${N_NYC.handleFn}(text)`),
    PARAGRAPH_NYC(
      'The main entry point for processing a reservation. Takes a natural language string, parses it, checks availability, and either books the reservation or returns an appropriate error.'
    ),
    PARAGRAPH_NYC([RICHTEXT_NYC('Input: ', { bold: true }), RICHTEXT_NYC('string \u2014 a natural language reservation request')]),
    PARAGRAPH_NYC([RICHTEXT_NYC('Returns: ', { bold: true }), RICHTEXT_NYC('Promise<object> \u2014 one of three response shapes:')]),

    HEADING3_NYC('Success Response'),
    CODEBLOCK_NYC(
      '{\n' +
        `  "${N_NYC.successField}": true,\n` +
        `  "${N_NYC.messageField}": "Reservation confirmed! Your confirmation number is RES-A3F7K.",\n` +
        `  "${N_NYC.confirmationField}": "RES-A3F7K",\n` +
        `  "${N_NYC.detailsField}": {\n` +
        `    "${N_NYC.dateField}": "2026-12-25",\n` +
        `    "${N_NYC.timeField}": "19:00",\n` +
        `    "${N_NYC.partySizeField}": 8\n` +
        '  },\n' +
        `  "${N_NYC.metricsField}": {\n` +
        `    "${N_NYC.largePartyMetric}": true\n` +
        '  }\n' +
        '}',
      'json'
    ),
    PARAGRAPH_NYC([
      RICHTEXT_NYC('The '),
      RICHTEXT_NYC(N_NYC.metricsField, { code: true }),
      RICHTEXT_NYC(' object is included on all successful responses. Available metrics:'),
    ]),
    BULLETITEM_NYC([
      RICHTEXT_NYC(N_NYC.largePartyMetric, { code: true }),
      RICHTEXT_NYC(': set to '),
      RICHTEXT_NYC('true', { code: true }),
      RICHTEXT_NYC(` when the party size exceeds ${N_NYC.largePartyThreshold} guests.`),
    ]),
    BULLETITEM_NYC([
      RICHTEXT_NYC(N_NYC.happyHourMetric, { code: true }),
      RICHTEXT_NYC(': set to '),
      RICHTEXT_NYC('true', { code: true }),
      RICHTEXT_NYC(` for reservations between ${N_NYC.happyHourStart > 12 ? N_NYC.happyHourStart - 12 : N_NYC.happyHourStart}\u2013${N_NYC.happyHourEnd > 12 ? N_NYC.happyHourEnd - 12 : N_NYC.happyHourEnd}pm.`),
    ]),
    BULLETITEM_NYC([
      RICHTEXT_NYC(N_NYC.brunchMetric, { code: true }),
      RICHTEXT_NYC(': set to '),
      RICHTEXT_NYC('true', { code: true }),
      RICHTEXT_NYC(` for reservations between ${N_NYC.brunchStart}am\u2013${N_NYC.brunchEnd > 12 ? N_NYC.brunchEnd - 12 : N_NYC.brunchEnd}pm.`),
    ]),
    BULLETITEM_NYC([
      RICHTEXT_NYC(N_NYC.lateNightMetric, { code: true }),
      RICHTEXT_NYC(': set to '),
      RICHTEXT_NYC('true', { code: true }),
      RICHTEXT_NYC(` when the reservation hour is ${N_NYC.lateNightHour}:00 or later.`),
    ]),

    HEADING3_NYC('Parsing Failure (missing date, time, or party size)'),
    CODEBLOCK_NYC(
      '{\n' +
        `  "${N_NYC.successField}": false,\n` +
        `  "${N_NYC.messageField}": "Could not understand your reservation request. Please include a date, time, and party size."\n` +
        '}',
      'json'
    ),

    HEADING3_NYC('Unavailable Slot'),
    CODEBLOCK_NYC(
      '{\n' +
        `  "${N_NYC.successField}": false,\n` +
        `  "${N_NYC.messageField}": "Sorry, that time slot is not available. Please try a different date or time."\n` +
        '}',
      'json'
    ),

    HEADING3_NYC('Flow'),
    CODEBLOCK_NYC(
      'Input text\n' +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${N_NYC.parseFn}(text)\n` +
        '    \u2502\n' +
        '    \u251C\u2500\u2500 Any field is null? \u2192 Return parsing error\n' +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${N_NYC.checkAvailFn}({ ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} })\n` +
        '    \u2502\n' +
        `    \u251C\u2500\u2500 ${N_NYC.availableField}: false \u2192 Return unavailable error\n` +
        '    \u2502\n' +
        '    \u25BC\n' +
        `${N_NYC.makeResFn}({ ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} })\n` +
        '    \u2502\n' +
        '    \u25BC\n' +
        'Return success with confirmation ID and details',
      'plain text'
    ),

    HEADING3_NYC('Source Code'),
    CODEBLOCK_NYC(HANDLERESERVATIONSRC_NYC, 'javascript'),
    DIVIDER_NYC(),

    // --- Integration Guide ---
    HEADING1_NYC('Integration Guide'),

    HEADING2_NYC('Step 1: Install'),
    CODEBLOCK_NYC('npm install', 'bash'),

    HEADING2_NYC('Step 2: Try the Demo'),
    CODEBLOCK_NYC('node src/index.js', 'bash'),

    HEADING2_NYC('Step 3: Use in Your Application'),
    CODEBLOCK_NYC(
      `const { ${N_NYC.handleFn} } = require('./src/handleReservation');\n\n` +
        '// From your chatbot, web form, SMS handler, etc.\n' +
        'const USERINPUT_NYC = "Table for 4 on December 25th at 7pm";\n' +
        `const RESULT_NYC = await ${N_NYC.handleFn}(USERINPUT_NYC);\n\n` +
        `if (RESULT_NYC.${N_NYC.successField}) {\n` +
        `  console.log(RESULT_NYC.${N_NYC.messageField});       // "Reservation confirmed! ..."\n` +
        `  console.log(RESULT_NYC.${N_NYC.confirmationField});   // "RES-A3F7K"\n` +
        `  console.log(RESULT_NYC.${N_NYC.detailsField});       // { ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} }\n` +
        '} else {\n' +
        `  console.log(RESULT_NYC.${N_NYC.messageField});\n` +
        '}',
      'javascript'
    ),

    HEADING2_NYC('Step 4: Connect to Your Real Database'),
    PARAGRAPH_NYC([
      RICHTEXT_NYC('Replace the functions in '),
      RICHTEXT_NYC('src/mockApi.js', { code: true }),
      RICHTEXT_NYC(' with your own implementations. The contract to maintain:'),
    ]),
    TABLEBLOCK_NYC(
      ['Function', 'Must Accept', 'Must Return'],
      [
        [N_NYC.checkAvailFn, `{ ${N_NYC.dateField}: string, ${N_NYC.timeField}: string, ${N_NYC.partySizeField}: number }`, `Promise<{ ${N_NYC.availableField}: boolean }>`],
        [N_NYC.makeResFn, `{ ${N_NYC.dateField}: string, ${N_NYC.timeField}: string, ${N_NYC.partySizeField}: number }`, `Promise<{ ${N_NYC.confirmField}: string }>`],
      ]
    ),
    PARAGRAPH_NYC('Example with a SQL database:'),
    CODEBLOCK_NYC(
      `async function ${N_NYC.checkAvailFn}({ ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} }) {\n` +
        '  const ROW_NYC = await db.query(\n' +
        "    'SELECT SUM(party_size) AS total FROM reservations WHERE date = ? AND time = ?',\n" +
        `    [${N_NYC.dateField}, ${N_NYC.timeField}]\n` +
        '  );\n' +
        '  const CURRENTCOUNT_NYC = ROW_NYC.total || 0;\n' +
        `  return { ${N_NYC.availableField}: CURRENTCOUNT_NYC + ${N_NYC.partySizeField} <= YOUR_CAPACITY };\n` +
        '}\n\n' +
        `async function ${N_NYC.makeResFn}({ ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField} }) {\n` +
        '  const CONFIRMATION_NYC = generateUniqueId();\n' +
        '  await db.query(\n' +
        "    'INSERT INTO reservations (confirmation, date, time, party_size) VALUES (?, ?, ?, ?)',\n" +
        `    [CONFIRMATION_NYC, ${N_NYC.dateField}, ${N_NYC.timeField}, ${N_NYC.partySizeField}]\n` +
        '  );\n' +
        `  return { ${N_NYC.confirmField}: CONFIRMATION_NYC };\n` +
        '}',
      'javascript'
    ),
    DIVIDER_NYC(),

    // --- Testing ---
    HEADING1_NYC('Testing'),
    PARAGRAPH_NYC('Run all 17 tests:'),
    CODEBLOCK_NYC('npm test', 'bash'),
    TABLEBLOCK_NYC(
      ['Test Suite', 'Count', 'What It Covers'],
      [
        ['parseRequest.test.js', '10', 'Date formats, time formats, party size patterns, edge cases, unparseable input'],
        ['handleReservation.test.js', '7', 'Successful booking, capacity exhaustion, incomplete input, missing fields, state reset'],
      ]
    ),
    DIVIDER_NYC(),

    // --- Data Formats Reference ---
    HEADING1_NYC('Data Formats Reference'),
    TABLEBLOCK_NYC(
      ['Field', 'Format', 'Example'],
      [
        [N_NYC.dateField, 'YYYY-MM-DD', '2026-12-25'],
        [N_NYC.timeField, 'HH:MM (24-hour)', '19:00'],
        [N_NYC.partySizeField, 'Integer', '4'],
        [N_NYC.confirmationField, 'RES-XXXXX', 'RES-A3F7K'],
      ]
    ),
    DIVIDER_NYC(),

    // --- Configuration ---
    HEADING1_NYC('Configuration'),
    TABLEBLOCK_NYC(
      ['Setting', 'Current Value', 'Location', 'Description'],
      [
        ['Slot capacity', `${N_NYC.capacityVal} guests`, 'src/mockApi.js line 1', 'Maximum total guests per date+time slot'],
      ]
    ),
    PARAGRAPH_NYC(
      'To change the capacity, update the capacity constant in mockApi.js, or move it to a config file / environment variable for production use.'
    ),
    DIVIDER_NYC(),

    // --- Demo Entry Point ---
    HEADING1_NYC('Demo Entry Point'),
    PARAGRAPH_NYC([RICHTEXT_NYC('File: '), RICHTEXT_NYC('src/index.js', { code: true })]),
    CODEBLOCK_NYC(INDEXSRC_NYC, 'javascript'),

    // --- Change Log ---
    HEADING1_NYC('Change Log'),
    CALLOUT_NYC(
      'This section tracks all changes to the reservation system.',
      '\uD83D\uDCCB'
    ),

    HEADING3_NYC('v1.4.0 \u2014 2026-04-08'),
    BULLETITEM_NYC('Auto-synced Notion design spec with update system'),
    BULLETITEM_NYC('Added change analysis pipeline (analyze-changes.js)'),
    BULLETITEM_NYC('Added review draft generator for proposed documentation updates'),

    HEADING3_NYC('v1.3.0 \u2014 2026-04-05'),
    BULLETITEM_NYC('Added support for "diners" keyword in party size parsing'),
    BULLETITEM_NYC([RICHTEXT_NYC('Renamed internal helper '), RICHTEXT_NYC('formatDateString', { code: true }), RICHTEXT_NYC(' \u2192 '), RICHTEXT_NYC('formatDate', { code: true })]),
    BULLETITEM_NYC('Evaluated migration from in-memory store to SQLite \u2014 deferred to v2.0'),

    HEADING3_NYC('v1.2.0 \u2014 2026-03-28'),
    BULLETITEM_NYC('capacity constant updated from 15 \u2192 20 guests per slot'),
    BULLETITEM_NYC([RICHTEXT_NYC('Added '), RICHTEXT_NYC('resetBookings()', { code: true }), RICHTEXT_NYC(' helper for test isolation')]),
    BULLETITEM_NYC('Fixed 24-hour time parsing fallback for ambiguous formats like 6:30'),

    HEADING3_NYC('v1.1.0 \u2014 2026-03-20'),
    BULLETITEM_NYC([RICHTEXT_NYC('New module: '), RICHTEXT_NYC('handleReservation.js', { code: true }), RICHTEXT_NYC(' orchestrator combining parse \u2192 validate \u2192 book flow')]),
    BULLETITEM_NYC('Added integration test suite (7 tests) covering end-to-end reservation flow'),
    BULLETITEM_NYC('Documented customer-facing error messages and UX copy guidelines'),

    HEADING3_NYC('v1.0.0 \u2014 2026-03-15'),
    BULLETITEM_NYC('Initial release of the reservation system'),
    BULLETITEM_NYC('Natural language parser supporting ISO dates, month names, US numeric formats'),
    BULLETITEM_NYC('Mock booking API with availability checking and confirmation ID generation'),
    BULLETITEM_NYC([RICHTEXT_NYC('Demo entry point ('), RICHTEXT_NYC('node src/index.js', { code: true }), RICHTEXT_NYC(')')]),
    BULLETITEM_NYC('10 unit tests for parser module'),

    // --- Footer ---
    DIVIDER_NYC(),
    PARAGRAPH_NYC([
      RICHTEXT_NYC('Last synced from '),
      RICHTEXT_NYC('amandalotwin/test', { code: true }),
      RICHTEXT_NYC(` on ${new Date().toISOString().split('T')[0]}.`),
    ]),
  ];

  return BLOCKS_NYC;
}

// --- Main ---

async function MAIN_NYC() {
  console.log('Building new page content from source files...');
  const BLOCKS_NYC = BUILDPAGEBLOCKS_NYC();
  console.log(`Generated ${BLOCKS_NYC.length} blocks.`);

  console.log('Fetching existing blocks from Notion page...');
  const EXISTINGBLOCKS_NYC = await GETCHILDBLOCKS_NYC(NOTION_PAGE_ID_NYC);
  console.log(`Found ${EXISTINGBLOCKS_NYC.length} existing blocks. Deleting...`);

  for (const BLOCK_NYC of EXISTINGBLOCKS_NYC) {
    await DELETEBLOCK_NYC(BLOCK_NYC.id);
  }
  console.log('Existing blocks deleted. Appending new content...');

  await APPENDCHILDREN_NYC(NOTION_PAGE_ID_NYC, BLOCKS_NYC);
  console.log('Notion page updated successfully!');
}

MAIN_NYC().catch((ERR_NYC) => {
  console.error('Failed to sync Notion page:', ERR_NYC.message);
  process.exit(1);
});
