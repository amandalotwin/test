/**
 * Parses a natural language reservation request and extracts date, time, and party size.
 *
 * @param {string} text - Natural language reservation request
 * @returns {{ date: string|null, time: string|null, partySize: number|null }}
 */
function parseRequest(text) {
  return {
    date: parseDate(text),
    time: parseTime(text),
    partySize: parsePartySize(text),
  };
}

const MONTH_MAP = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/**
 * Extracts and normalizes a date from text to YYYY-MM-DD format.
 * Supports: "March 15", "March 15th", "12/25", "2025-04-10"
 */
function parseDate(text) {
  // ISO format: YYYY-MM-DD
  const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return isoMatch[0];
  }

  // Month name + day: "March 15" or "March 15th"
  const monthNamePattern = new RegExp(
    `(${Object.keys(MONTH_MAP).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    'i'
  );
  const monthNameMatch = text.match(monthNamePattern);
  if (monthNameMatch) {
    const monthNum = MONTH_MAP[monthNameMatch[1].toLowerCase()];
    const day = parseInt(monthNameMatch[2], 10);
    const year = inferYear(monthNum, day);
    return formatDate(year, monthNum, day);
  }

  // Numeric format: MM/DD or MM/DD/YYYY
  const numericMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (numericMatch) {
    const month = parseInt(numericMatch[1], 10);
    const day = parseInt(numericMatch[2], 10);
    let year;
    if (numericMatch[3]) {
      year = parseInt(numericMatch[3], 10);
      if (year < 100) year += 2000;
    } else {
      year = inferYear(month, day);
    }
    return formatDate(year, month, day);
  }

  return null;
}

/**
 * Infers the year for a month/day combo. Uses the current year,
 * or next year if the date has already passed.
 */
function inferYear(month, day) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const candidate = new Date(currentYear, month - 1, day);
  if (candidate < now) {
    return currentYear + 1;
  }
  return currentYear;
}

function formatDate(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Extracts and normalizes a time from text to HH:MM (24-hour) format.
 * Supports: "7pm", "7:30 PM", "19:00"
 */
function parseTime(text) {
  // 24-hour format: 19:00
  const time24Match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]m)/i);
  if (time24Match) {
    const hours = parseInt(time24Match[1], 10);
    const minutes = parseInt(time24Match[2], 10);
    // Only treat as 24-hour if hours >= 13 or the format is unambiguous
    if (hours >= 13) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  // 12-hour format with minutes: "7:30 PM", "6:30PM"
  const time12MinMatch = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (time12MinMatch) {
    let hours = parseInt(time12MinMatch[1], 10);
    const minutes = parseInt(time12MinMatch[2], 10);
    const period = time12MinMatch[3].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // 12-hour format without minutes: "7pm", "7 pm"
  const time12Match = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (time12Match) {
    let hours = parseInt(time12Match[1], 10);
    const period = time12Match[2].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:00`;
  }

  // 24-hour format fallback (for cases like 19:00 that didn't match above due to am/pm check)
  if (time24Match) {
    const hours = parseInt(time24Match[1], 10);
    const minutes = parseInt(time24Match[2], 10);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extracts party size from text.
 * Supports: "for 4", "4 people", "party of 4"
 */
function parsePartySize(text) {
  // "for X people", "for X"
  const forMatch = text.match(/\bfor\s+(\d+)\s*(?:people|persons|guests|diners)?\b/i);
  if (forMatch) {
    return parseInt(forMatch[1], 10);
  }

  // "X people/persons/guests"
  const peopleMatch = text.match(/\b(\d+)\s+(?:people|persons|guests|diners)\b/i);
  if (peopleMatch) {
    return parseInt(peopleMatch[1], 10);
  }

  // "party of X"
  const partyMatch = text.match(/\bparty\s+of\s+(\d+)\b/i);
  if (partyMatch) {
    return parseInt(partyMatch[1], 10);
  }

  return null;
}

module.exports = { parseRequest };
