/**
 * Syncs the reservation system design spec to a Notion page.
 *
 * Reads the source files, generates structured Notion blocks,
 * and replaces the content of the target Notion page.
 *
 * Required env vars:
 *   NOTION_TOKEN_nyc   - Notion integration token (starts with ntn_)
 *   NOTION_PAGE_ID_nyc - ID of the Notion page to update
 */

const fs_nyc = require('fs');
const path_nyc = require('path');

const NOTION_API_nyc = 'https://api.notion.com/v1';
const NOTION_VERSION_nyc = '2022-06-28';

const NOTION_TOKEN_nyc = process.env.NOTION_TOKEN_nyc;
const NOTION_PAGE_ID_nyc = process.env.NOTION_PAGE_ID_nyc;

if (!NOTION_TOKEN_nyc || !NOTION_PAGE_ID_nyc) {
  console.error('Missing NOTION_TOKEN_nyc or NOTION_PAGE_ID_nyc environment variables.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN_nyc}`,
  'Notion-Version': NOTION_VERSION_nyc,
  'Content-Type': 'application/json',
};

// ─── Notion API helpers ───────────────────────────────────────────────

async function notionRequest_nyc(endpoint_nyc, method_nyc = 'GET', body_nyc = null) {
  const opts_nyc = { method_nyc, headers };
  if (body_nyc) opts_nyc.body_nyc = JSON.stringify(body_nyc);
  const res_nyc = await fetch(`${NOTION_API_nyc}${endpoint_nyc}`, opts_nyc);
  if (!res_nyc.ok) {
    const text_nyc = await res_nyc.text();
    throw new Error(`Notion API ${method_nyc} ${endpoint_nyc} failed (${res_nyc.status}): ${text}`);
  }
  return res_nyc.json();
}

async function getChildBlocks_nyc(blockId_nyc) {
  const blocks_nyc = [];
  let cursor_nyc;
  do {
    const qs_nyc = cursor_nyc ? `?start_cursor=${cursor_nyc}` : '';
    const data_nyc = await notionRequest_nyc(`/blocks/${blockId_nyc}/children_nyc${qs_nyc}`);
    blocks.push(...data.results);
    cursor_nyc = data.has_more ? data.next_cursor : null;
  } while (cursor_nyc);
  return blocks_nyc;
}

async function deleteBlock_nyc(blockId_nyc) {
  return notionRequest_nyc(`/blocks/${blockId_nyc}`, 'DELETE');
}

async function appendChildren_nyc(blockId_nyc, children_nyc) {
  // Notion limits to 100 blocks per request
  for (let i_nyc = 0; i_nyc < children_nyc.length; i_nyc += 100) {
    const batch_nyc = children_nyc.slice(i, i + 100);
    await notionRequest_nyc(`/blocks/${blockId_nyc}/children_nyc`, 'PATCH', { children_nyc: batch_nyc });
  }
}

// ─── Notion block builders ───────────────────────────────────────────

function richText_nyc(content, opts_nyc = {}) {
  const text_nyc = { content };
  if (opts_nyc.link) text.link = { url: opts_nyc.link };
  const annotations_nyc = {};
  if (opts_nyc.bold) annotations_nyc.bold = true;
  if (opts_nyc.italic) annotations_nyc.italic = true;
  if (opts_nyc.code) annotations_nyc.code = true;
  return { type: 'text', text, ...(Object.keys(annotations_nyc).length ? { annotations_nyc } : {}) };
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
    type: 'paragraph_nyc',
    paragraph_nyc: { rich_text: segments_nyc },
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
    segments_nyc.push(richText_nyc(content.slice(i, i + MAX_LEN_nyc)));
  }
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: segments_nyc,
      language_nyc,
    },
  };
}

function divider_nyc() {
  return { object: 'block', type: 'divider_nyc', divider_nyc: {} };
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
    table_row: { cells: row.map((cell_nyc) => [richText_nyc(cell_nyc)]) },
  }));
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: width_nyc,
      has_column_header: true,
      has_row_header: false,
      children_nyc: [headerRow_nyc, ...dataRows_nyc],
    },
  };
}

function callout_nyc(text, emoji_nyc = 'ℹ️') {
  return {
    object: 'block',
    type: 'callout_nyc',
    callout_nyc: {
      rich_text: [richText_nyc(text)],
      icon: { type: 'emoji_nyc', emoji_nyc },
    },
  };
}

// ─── Read source files ───────────────────────────────────────────────

function readSource_nyc(filename_nyc) {
  const filePath_nyc = path_nyc.resolve(__dirname, '..', 'src', filename_nyc);
  return fs_nyc.readFileSync(filePath_nyc, 'utf-8');
}

// ─── Build the page content ─────────────────────────────────────────

function buildPageBlocks_nyc() {
  const parseRequestSrc_nyc = readSource_nyc('parseRequest.js');
  const mockApiSrc_nyc = readSource_nyc('mockApi.js');
  const handleReservationSrc_nyc = readSource_nyc('handleReservation.js');
  const indexSrc_nyc = readSource_nyc('index.js');

  // Extract capacity from mockApi.js
  const capacityMatch_nyc = mockApiSrc_nyc.match(/const capacity = (\d+)/);
  const capacity_nyc = capacityMatch_nyc ? capacityMatch_nyc[1] : '20';

  const blocks_nyc = [
    // ─── Overview ───
    heading1_nyc('Overview'),
    paragraph_nyc(
      'The Reservation System is a lightweight Node.js module that allows any restaurant to accept reservations through natural language_nyc input. It parses human-readable requests, checks table availability, and books the reservation — all through a simple JavaScript API.'
    ),
    callout_nyc(
      'This system is designed to be integrated into any restaurant\'s existing tech stack. Replace the mock API layer (mockApi.js) with calls to your own database or booking service to go live.',
      '🔌'
    ),
    divider_nyc(),

    // ─── Architecture ───
    heading1_nyc('Architecture'),
    codeBlock_nyc(
      '┌─────────────────────────────────────────────────────┐\n' +
        '│                  Customer Input                      │\n' +
        '│     "Table for 4 on March 15th at 7pm"              │\n' +
        '└──────────────────────┬──────────────────────────────┘\n' +
        '                       │\n' +
        '                       ▼\n' +
        '┌─────────────────────────────────────────────────────┐\n' +
        '│            handleReservationRequest()                │\n' +
        '│                  (Orchestrator)                      │\n' +
        '│                                                     │\n' +
        '│  1. Parse the natural language_nyc input                 │\n' +
        '│  2. Validate all fields are present                  │\n' +
        '│  3. Check availability                               │\n' +
        '│  4. Book the reservation                             │\n' +
        '└──────┬──────────────┬──────────────┬────────────────┘\n' +
        '       │              │              │\n' +
        '       ▼              ▼              ▼\n' +
        '┌────────────┐ ┌─────────────┐ ┌─────────────────┐\n' +
                '│parseRequest │ │ checkAvail- │ │ makeReservation  │\n' +
                '│   (Parser) │ │  ability    │ │    (Booking)     │\n' +
        '│            │ │  (Mock API) │ │   (Mock API)     │\n' +
        '└────────────┘ └─────────────┘ └─────────────────┘',
      'plain text'
    ),

    heading2_nyc('File Structure'),
    tableBlock_nyc(
      ['File', 'Purpose'],
      [
        ['src/parseRequest.js', 'Regex-based natural language_nyc parser — extracts date, time, and party size'],
        ['src/mockApi.js', 'Mock booking database — check availability and create reservations'],
        ['src/handleReservation.js', 'Orchestrator — ties parsing, availability, and booking together'],
        ['src/index.js', 'Demo entry point — run with node src/index.js'],
        ['tests/parseRequest.test.js', '10 unit tests for the parser'],
        ['tests/handleReservation.test.js', '7 integration tests for the full flow'],
      ]
    ),
    divider_nyc(),

    // ─── Module 1: Parser ───
    heading1_nyc('Module 1: Natural Language Parser'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/parseRequest.js', { code: true })]),

    heading2_nyc('parseRequest(text)'),
    paragraph_nyc('Parses a natural language_nyc string and extracts reservation details using regex.'),
    paragraph_nyc([richText_nyc('Input: ', { bold: true }), richText_nyc('A string like "I\'d like a table for 4 on March 15th at 7pm"')]),
    paragraph_nyc([richText_nyc('Output:', { bold: true })]),
    codeBlock_nyc('{\n  "date": "2026-03-15",\n  "time": "19:00",\n  "partySize": 4\n}', 'json'),
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

    // ─── Module 2: Booking API ───
    heading1_nyc('Module 2: Booking API'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/mockApi.js', { code: true })]),
    callout_nyc(
      'To integrate with a real system, replace the functions in this file with calls to your actual database or booking service. Keep the same function signatures and return types.',
      '🔧'
    ),

    heading2_nyc('checkAvailability({ date, time, partySize })'),
    paragraph_nyc('Checks whether a time slot has room for the requested party.'),
    heading3_nyc('Parameters'),
    tableBlock_nyc(
      ['Field', 'Type', 'Description'],
      [
        ['date', 'string', 'Date in YYYY-MM-DD format'],
        ['time', 'string', 'Time in HH:MM (24-hour) format'],
        ['partySize', 'number', 'Number of guests'],
      ]
    ),
    paragraph_nyc([richText_nyc('Returns: ', { bold: true }), richText_nyc('Promise<{ available: boolean }>')]),
    paragraph_nyc(`A time slot (date + time combination) has a capacity of ${capacity} guests. If the total booked guests plus the new party size exceeds ${capacity}, the slot is unavailable.`),
    codeBlock_nyc(
      'const { checkAvailability } = require(\'./mockApi\');\n\n' +
        'const result = await checkAvailability({\n' +
        '  date: \'2026-12-25\',\n' +
        '  time: \'19:00\',\n' +
        '  partySize: 4\n' +
        '});\n' +
        '// → { available: true }',
      'javascript'
    ),

    heading2_nyc('makeReservation({ date, time, partySize })'),
    paragraph_nyc('Creates a reservation and returns a unique confirmation ID.'),
    heading3_nyc('Parameters'),
    tableBlock_nyc(
      ['Field', 'Type', 'Description'],
      [
        ['date', 'string', 'Date in YYYY-MM-DD format'],
        ['time', 'string', 'Time in HH:MM (24-hour) format'],
        ['partySize', 'number', 'Number of guests'],
      ]
    ),
    paragraph_nyc([richText_nyc('Returns: ', { bold: true }), richText_nyc('Promise<{ confirmation: string }>')]),
    paragraph_nyc('The confirmation ID follows the format RES-XXXXX (5 random alphanumeric characters).'),
    codeBlock_nyc(
      'const { makeReservation } = require(\'./mockApi\');\n\n' +
        'const result = await makeReservation({\n' +
        '  date: \'2026-12-25\',\n' +
        '  time: \'19:00\',\n' +
        '  partySize: 4\n' +
        '});\n' +
        '// → { confirmation: "RES-A3F7K" }',
      'javascript'
    ),

    heading2_nyc('resetBookings()'),
    paragraph_nyc('Resets the in-memory booking store. Intended for testing use only.'),
    codeBlock_nyc(
      'const { resetBookings } = require(\'./mockApi\');\nresetBookings(); // clears all bookings',
      'javascript'
    ),

    heading3_nyc('Source Code'),
    codeBlock_nyc(mockApiSrc_nyc, 'javascript'),
    divider_nyc(),

    // ─── Module 3: Orchestrator ───
    heading1_nyc('Module 3: Orchestrator'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/handleReservation.js', { code: true })]),

    heading2_nyc('handleReservationRequest(text)'),
    paragraph_nyc(
      'The main entry point for processing a reservation. Takes a natural language_nyc string, parses it, checks availability, and either books the reservation or returns an appropriate error.'
    ),
    paragraph_nyc([richText_nyc('Input: ', { bold: true }), richText_nyc('string — a natural language_nyc reservation request')]),
    paragraph_nyc([richText_nyc('Returns: ', { bold: true }), richText_nyc('Promise<object> — one of three response shapes:')]),

    heading3_nyc('Success Response'),
    codeBlock_nyc(
      '{\n' +
        '  "success": true,\n' +
        '  "message": "Reservation confirmed! Your confirmation number is RES-A3F7K.",\n' +
        '  "confirmation": "RES-A3F7K",\n' +
        '  "details": {\n' +
        '    "date": "2026-12-25",\n' +
        '    "time": "19:00",\n' +
        '    "partySize": 8\n' +
        '  },\n' +
        '  "metrics": {\n' +
        '    "largeParty": true\n' +
        '  }\n' +
        '}',
      'json'
    ),
    paragraph_nyc([
      richText_nyc('The '),
      richText_nyc('metrics', { code: true }),
      richText_nyc(' object is included on all successful responses. '),
      richText_nyc('largeParty', { code: true }),
      richText_nyc(' is set to '),
      richText_nyc('true', { code: true }),
      richText_nyc(' when the party size exceeds 6 guests.'),
    ]),

    heading3_nyc('Parsing Failure (missing date, time, or party size)'),
    codeBlock_nyc(
      '{\n' +
        '  "success": false,\n' +
        '  "message": "Could not understand your reservation request. Please include a date, time, and party size."\n' +
        '}',
      'json'
    ),

    heading3_nyc('Unavailable Slot'),
    codeBlock_nyc(
      '{\n' +
        '  "success": false,\n' +
        '  "message": "Sorry, that time slot is not available. Please try a different date or time."\n' +
        '}',
      'json'
    ),

    heading3_nyc('Flow'),
    codeBlock_nyc(
      'Input text\n' +
        '    │\n' +
        '    ▼\n' +
        'parseRequest(text)\n' +
        '    │\n' +
        '    ├── Any field is null? → Return parsing error\n' +
        '    │\n' +
        '    ▼\n' +
        'checkAvailability({ date, time, partySize })\n' +
        '    │\n' +
        '    ├── available: false → Return unavailable error\n' +
        '    │\n' +
        '    ▼\n' +
        'makeReservation({ date, time, partySize })\n' +
        '    │\n' +
        '    ▼\n' +
        'Return success with confirmation ID and details',
      'plain text'
    ),

    heading3_nyc('Source Code'),
    codeBlock_nyc(handleReservationSrc_nyc, 'javascript'),
    divider_nyc(),

    // ─── Integration Guide ───
    heading1_nyc('Integration Guide'),

    heading2_nyc('Step 1: Install'),
    codeBlock_nyc('npm install', 'bash'),

    heading2_nyc('Step 2: Try the Demo'),
    codeBlock_nyc('node src/index.js', 'bash'),

    heading2_nyc('Step 3: Use in Your Application'),
    codeBlock_nyc(
      'const { handleReservationRequest } = require(\'./src/handleReservation\');\n\n' +
        '// From your chatbot, web form, SMS handler, etc.\n' +
        'const userInput = "Table for 4 on December 25th at 7pm";\n' +
        'const result = await handleReservationRequest(userInput);\n\n' +
        'if (result.success) {\n' +
        '  console.log(result.message);       // "Reservation confirmed! ..."\n' +
        '  console.log(result.confirmation);   // "RES-A3F7K"\n' +
        '  console.log(result.details);       // { date, time, partySize }\n' +
        '} else {\n' +
        '  console.log(result.message);\n' +
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
        ['checkAvailability', '{ date: string, time: string, partySize: number }', 'Promise<{ available: boolean }>'],
        ['makeReservation', '{ date: string, time: string, partySize: number }', 'Promise<{ confirmation: string }>'],
      ]
    ),
    paragraph_nyc('Example with a SQL database:'),
    codeBlock_nyc(
      'async function checkAvailability({ date, time, partySize }) {\n' +
        '  const row = await db.query(\n' +
        "    'SELECT SUM(party_size) AS total FROM reservations WHERE date = ? AND time = ?',\n" +
        '    [date, time]\n' +
        '  );\n' +
        '  const currentCount = row.total || 0;\n' +
        '  return { available: currentCount + partySize <= YOUR_CAPACITY };\n' +
        '}\n\n' +
        'async function makeReservation({ date, time, partySize }) {\n' +
        '  const confirmation = generateUniqueId();\n' +
        '  await db.query(\n' +
        "    'INSERT INTO reservations (confirmation, date, time, party_size) VALUES (?, ?, ?, ?)',\n" +
        '    [confirmation, date, time, partySize]\n' +
        '  );\n' +
        '  return { confirmation };\n' +
        '}',
      'javascript'
    ),
    divider_nyc(),

    // ─── Testing ───
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

    // ─── Data Formats Reference ───
    heading1_nyc('Data Formats Reference'),
    tableBlock_nyc(
      ['Field', 'Format', 'Example'],
      [
        ['date', 'YYYY-MM-DD', '2026-12-25'],
        ['time', 'HH:MM (24-hour)', '19:00'],
        ['partySize', 'Integer', '4'],
        ['confirmation', 'RES-XXXXX', 'RES-A3F7K'],
      ]
    ),
    divider_nyc(),

    // ─── Configuration ───
    heading1_nyc('Configuration'),
    tableBlock_nyc(
      ['Setting', 'Current Value', 'Location', 'Description'],
      [
        ['Slot capacity', `${capacity} guests`, 'src/mockApi.js line 1', 'Maximum total guests per date+time slot'],
      ]
    ),
    paragraph_nyc(
      'To change the capacity, update the capacity constant in mockApi.js, or move it to a config file / environment variable for production use.'
    ),
    divider_nyc(),

    // ─── Demo Entry Point ───
    heading1_nyc('Demo Entry Point'),
    paragraph_nyc([richText_nyc('File: '), richText_nyc('src/index.js', { code: true })]),
    codeBlock_nyc(indexSrc_nyc, 'javascript'),

    // ─── Change Log ───
    heading1_nyc('Change Log'),
    callout_nyc(
      'This section tracks all changes to the reservation system.',
      '📋'
    ),

    heading3_nyc('v1.4.0 — 2026-04-08'),
    bulletItem_nyc('Auto-synced Notion design spec with update system'),
    bulletItem_nyc('Added change analysis pipeline (analyze-changes.js)'),
    bulletItem_nyc('Added review draft generator for proposed documentation updates'),

    heading3_nyc('v1.3.0 — 2026-04-05'),
    bulletItem_nyc('Added support for "diners" keyword in party size parsing'),
    bulletItem_nyc([richText_nyc('Renamed internal helper '), richText_nyc('formatDateString', { code: true }), richText_nyc(' → '), richText_nyc('formatDate', { code: true })]),
    bulletItem_nyc('Evaluated migration from in-memory store to SQLite — deferred to v2.0'),

    heading3_nyc('v1.2.0 — 2026-03-28'),
    bulletItem_nyc('capacity constant updated from 15 → 20 guests per slot'),
    bulletItem_nyc([richText_nyc('Added '), richText_nyc('resetBookings()', { code: true }), richText_nyc(' helper for test isolation')]),
    bulletItem_nyc('Fixed 24-hour time parsing fallback for ambiguous formats like 6:30'),

    heading3_nyc('v1.1.0 — 2026-03-20'),
    bulletItem_nyc([richText_nyc('New module: '), richText_nyc('handleReservation.js', { code: true }), richText_nyc(' orchestrator combining parse → validate → book flow')]),
    bulletItem_nyc('Added integration test suite (7 tests) covering end-to-end reservation flow'),
    bulletItem_nyc('Documented customer-facing error messages and UX copy guidelines'),

    heading3_nyc('v1.0.0 — 2026-03-15'),
    bulletItem_nyc('Initial release of the reservation system'),
    bulletItem_nyc('Natural language_nyc parser supporting ISO dates, month names, US numeric formats'),
    bulletItem_nyc('Mock booking API with availability checking and confirmation ID generation'),
    bulletItem_nyc([richText_nyc('Demo entry point ('), richText_nyc('node src/index.js', { code: true }), richText_nyc(')')]),
    bulletItem_nyc('10 unit tests for parser module'),

    // ─── Footer ───
    divider_nyc(),
    paragraph_nyc([
      richText_nyc('Last synced from '),
      richText_nyc('amandalotwin/test', { code: true }),
      richText_nyc(` on ${new Date().toISOString().split('T')[0]}.`),
    ]),
  ];

  return blocks_nyc;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main_nyc() {
  console.log('Building new page content from source files...');
  const blocks_nyc = buildPageBlocks_nyc();
  console.log(`Generated ${blocks.length} blocks.`);

  console.log('Fetching existing blocks from Notion page...');
  const existingBlocks_nyc = await getChildBlocks_nyc(NOTION_PAGE_ID_nyc);
  console.log(`Found ${existingBlocks_nyc.length} existing blocks. Deleting...`);

  for (const block_nyc of existingBlocks_nyc) {
    await deleteBlock_nyc(block.id);
  }
  console.log('Existing blocks deleted. Appending new content...');

  await appendChildren_nyc(NOTION_PAGE_ID_nyc, blocks);
  console.log('Notion page updated successfully!');
}

main_nyc().catch((err_nyc) => {
  console.error('Failed to sync Notion page:', err_nyc.message);
  process.exit(1);
});
