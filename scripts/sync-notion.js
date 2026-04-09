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

const fs = require('fs');
const path = require('path');

const NOTION_API = 'https://api.notion.com/v1';
const NOTION_VERSION = '2022-06-28';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_PAGE_ID = process.env.NOTION_PAGE_ID;

if (!NOTION_TOKEN || !NOTION_PAGE_ID) {
  console.error('Missing NOTION_TOKEN or NOTION_PAGE_ID environment variables.');
  process.exit(1);
}

const headers = {
  Authorization: `Bearer ${NOTION_TOKEN}`,
  'Notion-Version': NOTION_VERSION,
  'Content-Type': 'application/json',
};

// ─── Notion API helpers ───────────────────────────────────────────────

async function notionRequest(endpoint, method = 'GET', body = null) {
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${NOTION_API}${endpoint}`, opts);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API ${method} ${endpoint} failed (${res.status}): ${text}`);
  }
  return res.json();
}

async function getChildBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const qs = cursor ? `?start_cursor=${cursor}` : '';
    const data = await notionRequest(`/blocks/${blockId}/children${qs}`);
    blocks.push(...data.results);
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);
  return blocks;
}

async function deleteBlock(blockId) {
  return notionRequest(`/blocks/${blockId}`, 'DELETE');
}

async function appendChildren(blockId, children) {
  // Notion limits to 100 blocks per request
  for (let i = 0; i < children.length; i += 100) {
    const batch = children.slice(i, i + 100);
    await notionRequest(`/blocks/${blockId}/children`, 'PATCH', { children: batch });
  }
}

// ─── Notion block builders ───────────────────────────────────────────

function richText(content, opts = {}) {
  const text = { content };
  if (opts.link) text.link = { url: opts.link };
  const annotations = {};
  if (opts.bold) annotations.bold = true;
  if (opts.italic) annotations.italic = true;
  if (opts.code) annotations.code = true;
  return { type: 'text', text, ...(Object.keys(annotations).length ? { annotations } : {}) };
}

function heading1(text) {
  return {
    object: 'block',
    type: 'heading_1',
    heading_1: { rich_text: [richText(text)] },
  };
}

function heading2(text) {
  return {
    object: 'block',
    type: 'heading_2',
    heading_2: { rich_text: [richText(text)] },
  };
}

function heading3(text) {
  return {
    object: 'block',
    type: 'heading_3',
    heading_3: { rich_text: [richText(text)] },
  };
}

function paragraph(segments) {
  if (typeof segments === 'string') segments = [richText(segments)];
  return {
    object: 'block',
    type: 'paragraph',
    paragraph: { rich_text: segments },
  };
}

function bulletItem(segments) {
  if (typeof segments === 'string') segments = [richText(segments)];
  return {
    object: 'block',
    type: 'bulleted_list_item',
    bulleted_list_item: { rich_text: segments },
  };
}

function codeBlock(content, language = 'javascript') {
  // Notion limits each rich_text segment to 2000 chars
  const MAX_LEN = 2000;
  const segments = [];
  for (let i = 0; i < content.length; i += MAX_LEN) {
    segments.push(richText(content.slice(i, i + MAX_LEN)));
  }
  return {
    object: 'block',
    type: 'code',
    code: {
      rich_text: segments,
      language,
    },
  };
}

function divider() {
  return { object: 'block', type: 'divider', divider: {} };
}

function tableBlock(headers, rows) {
  const width = headers.length;
  const headerRow = {
    object: 'block',
    type: 'table_row',
    table_row: { cells: headers.map((h) => [richText(h, { bold: true })]) },
  };
  const dataRows = rows.map((row) => ({
    object: 'block',
    type: 'table_row',
    table_row: { cells: row.map((cell) => [richText(cell)]) },
  }));
  return {
    object: 'block',
    type: 'table',
    table: {
      table_width: width,
      has_column_header: true,
      has_row_header: false,
      children: [headerRow, ...dataRows],
    },
  };
}

function callout(text, emoji = 'ℹ️') {
  return {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [richText(text)],
      icon: { type: 'emoji', emoji },
    },
  };
}

// ─── Read source files ───────────────────────────────────────────────

function readSource(filename) {
  const filePath = path.resolve(__dirname, '..', 'src', filename);
  return fs.readFileSync(filePath, 'utf-8');
}

// ─── Build the page content ─────────────────────────────────────────

function buildPageBlocks() {
  const parseRequestSrc = readSource('parseRequest.js');
  const mockApiSrc = readSource('mockApi.js');
  const handleReservationSrc = readSource('handleReservation.js');
  const indexSrc = readSource('index.js');

  // Extract capacity from mockApi.js
  const capacityMatch = mockApiSrc.match(/const capacity = (\d+)/);
  const capacity = capacityMatch ? capacityMatch[1] : '20';

  const blocks = [
    // ─── Overview ───
    heading1('Overview'),
    paragraph(
      'The Reservation System is a lightweight Node.js module that allows any restaurant to accept reservations through natural language input. It parses human-readable requests, checks table availability, and books the reservation — all through a simple JavaScript API.'
    ),
    callout(
      'This system is designed to be integrated into any restaurant\'s existing tech stack. Replace the mock API layer (mockApi.js) with calls to your own database or booking service to go live.',
      '🔌'
    ),
    divider(),

    // ─── Architecture ───
    heading1('Architecture'),
    codeBlock(
      '┌─────────────────────────────────────────────────────┐\n' +
        '│                  Customer Input                      │\n' +
        '│     "Table for 4 on March 15th at 7pm"              │\n' +
        '└──────────────────────┬──────────────────────────────┘\n' +
        '                       │\n' +
        '                       ▼\n' +
        '┌─────────────────────────────────────────────────────┐\n' +
        '│              handleReservationRequest()              │\n' +
        '│                  (Orchestrator)                      │\n' +
        '│                                                     │\n' +
        '│  1. Parse the natural language input                 │\n' +
        '│  2. Validate all fields are present                  │\n' +
        '│  3. Check availability                               │\n' +
        '│  4. Book the reservation                             │\n' +
        '└──────┬──────────────┬──────────────┬────────────────┘\n' +
        '       │              │              │\n' +
        '       ▼              ▼              ▼\n' +
        '┌────────────┐ ┌─────────────┐ ┌─────────────────┐\n' +
        '│ parseRequest│ │ checkAvail- │ │ makeReservation  │\n' +
        '│   (Parser) │ │  ability    │ │   (Booking)      │\n' +
        '│            │ │  (Mock API) │ │   (Mock API)     │\n' +
        '└────────────┘ └─────────────┘ └─────────────────┘',
      'plain text'
    ),

    heading2('File Structure'),
    tableBlock(
      ['File', 'Purpose'],
      [
        ['src/parseRequest.js', 'Regex-based natural language parser — extracts date, time, and party size'],
        ['src/mockApi.js', 'Mock booking database — check availability and create reservations'],
        ['src/handleReservation.js', 'Orchestrator — ties parsing, availability, and booking together'],
        ['src/index.js', 'Demo entry point — run with node src/index.js'],
        ['tests/parseRequest.test.js', '10 unit tests for the parser'],
        ['tests/handleReservation.test.js', '7 integration tests for the full flow'],
      ]
    ),
    divider(),

    // ─── Module 1: Parser ───
    heading1('Module 1: Natural Language Parser'),
    paragraph([richText('File: '), richText('src/parseRequest.js', { code: true })]),

    heading2('parseRequest(text)'),
    paragraph('Parses a natural language string and extracts reservation details using regex.'),
    paragraph([richText('Input: ', { bold: true }), richText('A string like "I\'d like a table for 4 on March 15th at 7pm"')]),
    paragraph([richText('Output:', { bold: true })]),
    codeBlock('{\n  "date": "2026-03-15",\n  "time": "19:00",\n  "partySize": 4\n}', 'json'),
    paragraph('Any field that cannot be extracted returns null.'),

    heading3('Supported Date Formats'),
    tableBlock(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['ISO 8601', '2025-04-10', '2025-04-10'],
        ['Month name + day', 'March 15 or March 15th', 'YYYY-03-15'],
        ['Numeric (US)', '12/25 or 12/25/2026', 'YYYY-12-25'],
      ]
    ),
    paragraph('When no year is provided, the system infers the next upcoming occurrence of that date.'),

    heading3('Supported Time Formats'),
    tableBlock(
      ['Format', 'Example Input', 'Normalized Output'],
      [
        ['12-hour with minutes', '6:30 PM', '18:30'],
        ['12-hour without minutes', '7pm', '19:00'],
        ['24-hour', '19:00', '19:00'],
      ]
    ),
    paragraph('All times are normalized to HH:MM in 24-hour format.'),

    heading3('Supported Party Size Patterns'),
    tableBlock(
      ['Pattern', 'Example Input'],
      [
        ['for X', 'table for 4'],
        ['X people', '2 people'],
        ['party of X', 'party of 8'],
      ]
    ),
    paragraph('Also recognizes: persons, guests, diners.'),

    heading3('Source Code'),
    codeBlock(parseRequestSrc, 'javascript'),
    divider(),

    // ─── Module 2: Booking API ───
    heading1('Module 2: Booking API'),
    paragraph([richText('File: '), richText('src/mockApi.js', { code: true })]),
    callout(
      'To integrate with a real system, replace the functions in this file with calls to your actual database or booking service. Keep the same function signatures and return types.',
      '🔧'
    ),

    heading2('checkAvailability({ date, time, partySize })'),
    paragraph('Checks whether a time slot has room for the requested party.'),
    heading3('Parameters'),
    tableBlock(
      ['Field', 'Type', 'Description'],
      [
        ['date', 'string', 'Date in YYYY-MM-DD format'],
        ['time', 'string', 'Time in HH:MM (24-hour) format'],
        ['partySize', 'number', 'Number of guests'],
      ]
    ),
    paragraph([richText('Returns: ', { bold: true }), richText('Promise<{ available: boolean }>')]),
    paragraph(`A time slot (date + time combination) has a capacity of ${capacity} guests. If the total booked guests plus the new party size exceeds ${capacity}, the slot is unavailable.`),
    codeBlock(
      'const { checkAvailability } = require(\'./mockApi\');\n\n' +
        'const result = await checkAvailability({\n' +
        '  date: \'2026-12-25\',\n' +
        '  time: \'19:00\',\n' +
        '  partySize: 4\n' +
        '});\n' +
        '// → { available: true }',
      'javascript'
    ),

    heading2('makeReservation({ date, time, partySize })'),
    paragraph('Creates a reservation and returns a unique confirmation ID.'),
    heading3('Parameters'),
    tableBlock(
      ['Field', 'Type', 'Description'],
      [
        ['date', 'string', 'Date in YYYY-MM-DD format'],
        ['time', 'string', 'Time in HH:MM (24-hour) format'],
        ['partySize', 'number', 'Number of guests'],
      ]
    ),
    paragraph([richText('Returns: ', { bold: true }), richText('Promise<{ confirmation: string }>')]),
    paragraph('The confirmation ID follows the format RES-XXXXX (5 random alphanumeric characters).'),
    codeBlock(
      'const { makeReservation } = require(\'./mockApi\');\n\n' +
        'const result = await makeReservation({\n' +
        '  date: \'2026-12-25\',\n' +
        '  time: \'19:00\',\n' +
        '  partySize: 4\n' +
        '});\n' +
        '// → { confirmation: "RES-A3F7K" }',
      'javascript'
    ),

    heading2('resetBookings()'),
    paragraph('Resets the in-memory booking store. Intended for testing use only.'),
    codeBlock(
      'const { resetBookings } = require(\'./mockApi\');\nresetBookings(); // clears all bookings',
      'javascript'
    ),

    heading3('Source Code'),
    codeBlock(mockApiSrc, 'javascript'),
    divider(),

    // ─── Module 3: Orchestrator ───
    heading1('Module 3: Orchestrator'),
    paragraph([richText('File: '), richText('src/handleReservation.js', { code: true })]),

    heading2('handleReservationRequest(text)'),
    paragraph(
      'The main entry point for processing a reservation. Takes a natural language string, parses it, checks availability, and either books the reservation or returns an appropriate error.'
    ),
    paragraph([richText('Input: ', { bold: true }), richText('string — a natural language reservation request')]),
    paragraph([richText('Returns: ', { bold: true }), richText('Promise<object> — one of three response shapes:')]),

    heading3('Success Response'),
    codeBlock(
      '{\n' +
        '  "success": true,\n' +
        '  "message": "Reservation confirmed! Your confirmation number is RES-A3F7K.",\n' +
        '  "confirmation": "RES-A3F7K",\n' +
        '  "details": {\n' +
        '    "date": "2026-12-25",\n' +
        '    "time": "19:00",\n' +
        '    "partySize": 4\n' +
        '  }\n' +
        '}',
      'json'
    ),

    heading3('Parsing Failure (missing date, time, or party size)'),
    codeBlock(
      '{\n' +
        '  "success": false,\n' +
        '  "message": "Could not understand your reservation request. Please include a date, time, and party size."\n' +
        '}',
      'json'
    ),

    heading3('Unavailable Slot'),
    codeBlock(
      '{\n' +
        '  "success": false,\n' +
        '  "message": "Sorry, that time slot is not available. Please try a different date or time."\n' +
        '}',
      'json'
    ),

    heading3('Flow'),
    codeBlock(
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

    heading3('Source Code'),
    codeBlock(handleReservationSrc, 'javascript'),
    divider(),

    // ─── Integration Guide ───
    heading1('Integration Guide'),

    heading2('Step 1: Install'),
    codeBlock('npm install', 'bash'),

    heading2('Step 2: Try the Demo'),
    codeBlock('node src/index.js', 'bash'),

    heading2('Step 3: Use in Your Application'),
    codeBlock(
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

    heading2('Step 4: Connect to Your Real Database'),
    paragraph([
      richText('Replace the functions in '),
      richText('src/mockApi.js', { code: true }),
      richText(' with your own implementations. The contract to maintain:'),
    ]),
    tableBlock(
      ['Function', 'Must Accept', 'Must Return'],
      [
        ['checkAvailability', '{ date: string, time: string, partySize: number }', 'Promise<{ available: boolean }>'],
        ['makeReservation', '{ date: string, time: string, partySize: number }', 'Promise<{ confirmation: string }>'],
      ]
    ),
    paragraph('Example with a SQL database:'),
    codeBlock(
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
    divider(),

    // ─── Testing ───
    heading1('Testing'),
    paragraph('Run all 17 tests:'),
    codeBlock('npm test', 'bash'),
    tableBlock(
      ['Test Suite', 'Count', 'What It Covers'],
      [
        ['parseRequest.test.js', '10', 'Date formats, time formats, party size patterns, edge cases, unparseable input'],
        ['handleReservation.test.js', '7', 'Successful booking, capacity exhaustion, incomplete input, missing fields, state reset'],
      ]
    ),
    divider(),

    // ─── Data Formats Reference ───
    heading1('Data Formats Reference'),
    tableBlock(
      ['Field', 'Format', 'Example'],
      [
        ['date', 'YYYY-MM-DD', '2026-12-25'],
        ['time', 'HH:MM (24-hour)', '19:00'],
        ['partySize', 'Integer', '4'],
        ['confirmation', 'RES-XXXXX', 'RES-A3F7K'],
      ]
    ),
    divider(),

    // ─── Configuration ───
    heading1('Configuration'),
    tableBlock(
      ['Setting', 'Current Value', 'Location', 'Description'],
      [
        ['Slot capacity', `${capacity} guests`, 'src/mockApi.js line 1', 'Maximum total guests per date+time slot'],
      ]
    ),
    paragraph(
      'To change the capacity, update the capacity constant in mockApi.js, or move it to a config file / environment variable for production use.'
    ),
    divider(),

    // ─── Demo Entry Point ───
    heading1('Demo Entry Point'),
    paragraph([richText('File: '), richText('src/index.js', { code: true })]),
    codeBlock(indexSrc, 'javascript'),

    // ─── Change Log ───
    heading1('Change Log'),
    callout(
      'This section tracks all changes to the reservation system. Entries are added automatically for Tier 1 changes and manually for reviewed changes.',
      '📋'
    ),

    heading3('v1.4.0 — 2026-04-08'),
    bulletItem([richText('[Tier 1] ', { bold: true }), richText('Auto-synced Notion design spec with three-tier update system')]),
    bulletItem([richText('[Tier 1] ', { bold: true }), richText('Added change analysis pipeline (analyze-changes.js)')]),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Added review draft generator for proposed documentation updates')]),

    heading3('v1.3.0 — 2026-04-05'),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Added support for "diners" keyword in party size parsing')]),
    bulletItem([richText('[Tier 1] ', { bold: true }), richText('Renamed internal helper '), richText('formatDateString', { code: true }), richText(' → '), richText('formatDate', { code: true })]),
    bulletItem([richText('[Tier 3] ', { bold: true }), richText('Evaluated migration from in-memory store to SQLite — deferred to v2.0')]),

    heading3('v1.2.0 — 2026-03-28'),
    bulletItem([richText('[Tier 1] ', { bold: true }), richText('capacity constant updated from 15 → 20 guests per slot')]),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Added '), richText('resetBookings()', { code: true }), richText(' helper for test isolation')]),
    bulletItem([richText('[Tier 1] ', { bold: true }), richText('Fixed 24-hour time parsing fallback for ambiguous formats like 6:30')]),

    heading3('v1.1.0 — 2026-03-20'),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('New module: '), richText('handleReservation.js', { code: true }), richText(' orchestrator combining parse → validate → book flow')]),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Added integration test suite (7 tests) covering end-to-end reservation flow')]),
    bulletItem([richText('[Tier 3] ', { bold: true }), richText('Documented customer-facing error messages and UX copy guidelines')]),

    heading3('v1.0.0 — 2026-03-15'),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Initial release of the reservation system')]),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Natural language parser supporting ISO dates, month names, US numeric formats')]),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Mock booking API with availability checking and confirmation ID generation')]),
    bulletItem([richText('[Tier 2] ', { bold: true }), richText('Demo entry point ('), richText('node src/index.js', { code: true }), richText(')')]),
    bulletItem([richText('[Tier 1] ', { bold: true }), richText('10 unit tests for parser module')]),

    // ─── Footer ───
    divider(),
    paragraph([
      richText('Last synced from '),
      richText('amandalotwin/test', { code: true }),
      richText(` on ${new Date().toISOString().split('T')[0]}.`),
    ]),
  ];

  return blocks;
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('Building new page content from source files...');
  const blocks = buildPageBlocks();
  console.log(`Generated ${blocks.length} blocks.`);

  console.log('Fetching existing blocks from Notion page...');
  const existingBlocks = await getChildBlocks(NOTION_PAGE_ID);
  console.log(`Found ${existingBlocks.length} existing blocks. Deleting...`);

  for (const block of existingBlocks) {
    await deleteBlock(block.id);
  }
  console.log('Existing blocks deleted. Appending new content...');

  await appendChildren(NOTION_PAGE_ID, blocks);
  console.log('Notion page updated successfully!');
}

main().catch((err) => {
  console.error('Failed to sync Notion page:', err.message);
  process.exit(1);
});
