/**
 * Parses a natural language reservation request and extracts date, time, and party size.
 *
 * @param {string} text - Natural language reservation request
 * @returns {{ date: string|null, time: string|null, party_size: number|null }}
 */
function parse_request(text) {
  return {
    date: parse_date(text),
    time: parse_time(text),
    party_size: parse_party_size(text),
  };
}

const month_map = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/**
 * Extracts and normalizes a date from text to YYYY-MM-DD format.
 * Supports: "March 15", "March 15th", "12/25", "2025-04-10"
 */
function parse_date(text) {
  // ISO format: YYYY-MM-DD
  const iso_match = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso_match) {
    return iso_match[0];
  }

  // Month name + day: "March 15" or "March 15th"
  const month_name_pattern = new RegExp(
    `(${Object.keys(month_map).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    'i'
  );
  const month_name_match = text.match(month_name_pattern);
  if (month_name_match) {
    const month_num = month_map[month_name_match[1].toLowerCase()];
    const day = parseInt(month_name_match[2], 10);
    const year = infer_year(month_num, day);
    return format_date(year, month_num, day);
  }

  // Numeric format: MM/DD or MM/DD/YYYY
  const numeric_match = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (numeric_match) {
    const month = parseInt(numeric_match[1], 10);
    const day = parseInt(numeric_match[2], 10);
    let year;
    if (numeric_match[3]) {
      year = parseInt(numeric_match[3], 10);
      if (year < 100) year += 2000;
    } else {
      year = infer_year(month, day);
    }
    return format_date(year, month, day);
  }

  return null;
}

/**
 * Infers the year for a month/day combo. Uses the current year,
 * or next year if the date has already passed.
 */
function infer_year(month, day) {
  const now = new Date();
  const current_year = now.getFullYear();
  const candidate = new Date(current_year, month - 1, day);
  if (candidate < now) {
    return current_year + 1;
  }
  return current_year;
}

function format_date(year, month, day) {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * Extracts and normalizes a time from text to HH:MM (24-hour) format.
 * Supports: "7pm", "7:30 PM", "19:00"
 */
function parse_time(text) {
  // 24-hour format: 19:00
  const time24_match = text.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]m)/i);
  if (time24_match) {
    const hours = parseInt(time24_match[1], 10);
    const minutes = parseInt(time24_match[2], 10);
    // Only treat as 24-hour if hours >= 13 or the format is unambiguous
    if (hours >= 13) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    }
  }

  // 12-hour format with minutes: "7:30 PM", "6:30PM"
  const time12_min_match = text.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (time12_min_match) {
    let hours = parseInt(time12_min_match[1], 10);
    const minutes = parseInt(time12_min_match[2], 10);
    const period = time12_min_match[3].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // 12-hour format without minutes: "7pm", "7 pm"
  const time12_match = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (time12_match) {
    let hours = parseInt(time12_match[1], 10);
    const period = time12_match[2].toLowerCase();
    if (period === 'pm' && hours !== 12) hours += 12;
    if (period === 'am' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:00`;
  }

  // 24-hour format fallback (for cases like 19:00 that didn't match above due to am/pm check)
  if (time24_match) {
    const hours = parseInt(time24_match[1], 10);
    const minutes = parseInt(time24_match[2], 10);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extracts party size from text.
 * Supports: "for 4", "4 people", "party of 4"
 */
function parse_party_size(text) {
  // "for X people", "for X"
  const for_match = text.match(/\bfor\s+(\d+)\s*(?:people|persons|guests|diners)?\b/i);
  if (for_match) {
    return parseInt(for_match[1], 10);
  }

  // "X people/persons/guests"
  const people_match = text.match(/\b(\d+)\s+(?:people|persons|guests|diners)\b/i);
  if (people_match) {
    return parseInt(people_match[1], 10);
  }

  // "party of X"
  const party_match = text.match(/\bparty\s+of\s+(\d+)\b/i);
  if (party_match) {
    return parseInt(party_match[1], 10);
  }

  return null;
}

module.exports = { parse_request };
