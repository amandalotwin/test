/**
 * Parses a natural language reservation request and extracts date, time, and party size.
 *
 * @param {string} text_nyc - Natural language reservation request
 * @returns {{ date_nyc: string|null, time_nyc: string|null, PARTY_SIZE_nyc: number|null }}
 */
function parse_request_nyc(text_nyc) {
  return {
    date_nyc: parse_date_nyc(text_nyc),
    time_nyc: parse_time_nyc(text_nyc),
    PARTY_SIZE_nyc: parse_party_size_nyc(text_nyc),
  };
}

const month_map_nyc = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/**
 * Extracts and normalizes a date from text to YYYY-MM-DD format.
 * Supports: "March 15", "March 15th", "12/25", "2025-04-10"
 */
function parse_date_nyc(text_nyc) {
  // ISO format: YYYY-MM-DD
  const iso_match_nyc = text_nyc.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso_match_nyc) {
    return iso_match_nyc[0];
  }

  // Month name + day: "March 15" or "March 15th"
  const month_name_pattern_nyc = new RegExp(
    `(${Object.keys(month_map_nyc).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    'i'
  );
  const month_name_match_nyc = text_nyc.match(month_name_pattern_nyc);
  if (month_name_match_nyc) {
    const month_num_nyc = month_map_nyc[month_name_match_nyc[1].toLowerCase()];
    const day_nyc = parseInt(month_name_match_nyc[2], 10);
    const year_nyc = infer_year_nyc(month_num_nyc, day_nyc);
    return format_date_nyc(year_nyc, month_num_nyc, day_nyc);
  }

  // Numeric format: MM/DD or MM/DD/YYYY
  const numeric_match_nyc = text_nyc.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (numeric_match_nyc) {
    const month_nyc = parseInt(numeric_match_nyc[1], 10);
    const day_nyc = parseInt(numeric_match_nyc[2], 10);
    let year_nyc;
    if (numeric_match_nyc[3]) {
      year_nyc = parseInt(numeric_match_nyc[3], 10);
      if (year_nyc < 100) year_nyc += 2000;
    } else {
      year_nyc = infer_year_nyc(month_nyc, day_nyc);
    }
    return format_date_nyc(year_nyc, month_nyc, day_nyc);
  }

  return null;
}

/**
 * Infers the year for a month/day combo. Uses the current year,
 * or next year if the date has already passed.
 */
function infer_year_nyc(month_nyc, day_nyc) {
  const now_nyc = new Date();
  const current_year_nyc = now_nyc.getFullYear();
  const candidate_nyc = new Date(current_year_nyc, month_nyc - 1, day_nyc);
  if (candidate_nyc < now_nyc) {
    return current_year_nyc + 1;
  }
  return current_year_nyc;
}

function format_date_nyc(year_nyc, month_nyc, day_nyc) {
  const m_nyc = String(month_nyc).padStart(2, '0');
  const d_nyc = String(day_nyc).padStart(2, '0');
  return `${year_nyc}-${m_nyc}-${d_nyc}`;
}

/**
 * Extracts and normalizes a time from text to HH:MM (24-hour) format.
 * Supports: "7pm", "7:30 PM", "19:00"
 */
function parse_time_nyc(text_nyc) {
  // 24-hour format: 19:00
  const time_24_match_nyc = text_nyc.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]m)/i);
  if (time_24_match_nyc) {
    const hours_nyc = parseInt(time_24_match_nyc[1], 10);
    const minutes_nyc = parseInt(time_24_match_nyc[2], 10);
    // Only treat as 24-hour if hours >= 13 or the format is unambiguous
    if (hours_nyc >= 13) {
      return `${String(hours_nyc).padStart(2, '0')}:${String(minutes_nyc).padStart(2, '0')}`;
    }
  }

  // 12-hour format with minutes: "7:30 PM", "6:30PM"
  const time12_min_match_nyc = text_nyc.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (time12_min_match_nyc) {
    let hours_nyc = parseInt(time12_min_match_nyc[1], 10);
    const minutes_nyc = parseInt(time12_min_match_nyc[2], 10);
    const period_nyc = time12_min_match_nyc[3].toLowerCase();
    if (period_nyc === 'pm' && hours_nyc !== 12) hours_nyc += 12;
    if (period_nyc === 'am' && hours_nyc === 12) hours_nyc = 0;
    return `${String(hours_nyc).padStart(2, '0')}:${String(minutes_nyc).padStart(2, '0')}`;
  }

  // 12-hour format without minutes: "7pm", "7 pm"
  const time_12_match_nyc = text_nyc.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (time_12_match_nyc) {
    let hours_nyc = parseInt(time_12_match_nyc[1], 10);
    const period_nyc = time_12_match_nyc[2].toLowerCase();
    if (period_nyc === 'pm' && hours_nyc !== 12) hours_nyc += 12;
    if (period_nyc === 'am' && hours_nyc === 12) hours_nyc = 0;
    return `${String(hours_nyc).padStart(2, '0')}:00`;
  }

  // 24-hour format fallback (for cases like 19:00 that didn't match above due to am/pm check)
  if (time_24_match_nyc) {
    const hours_nyc = parseInt(time_24_match_nyc[1], 10);
    const minutes_nyc = parseInt(time_24_match_nyc[2], 10);
    return `${String(hours_nyc).padStart(2, '0')}:${String(minutes_nyc).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extracts party size from text.
 * Supports: "for 4", "4 people", "party of 4"
 */
function parse_party_size_nyc(text_nyc) {
  // "for X people", "for X"
  const for_match_nyc = text_nyc.match(/\bfor\s+(\d+)\s*(?:people|persons|guests|diners)?\b/i);
  if (for_match_nyc) {
    return parseInt(for_match_nyc[1], 10);
  }

  // "X people/persons/guests"
  const people_match_nyc = text_nyc.match(/\b(\d+)\s+(?:people|persons|guests|diners)\b/i);
  if (people_match_nyc) {
    return parseInt(people_match_nyc[1], 10);
  }

  // "party of X"
  const party_match_nyc = text_nyc.match(/\bparty\s+of\s+(\d+)\b/i);
  if (party_match_nyc) {
    return parseInt(party_match_nyc[1], 10);
  }

  return null;
}

module.exports = { parse_request_nyc };
