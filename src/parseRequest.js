/**
 * Parses a natural language reservation request and extracts date, time, and party size.
 *
 * @param {string} text_nyc - Natural language reservation request
 * @returns {{ date_nyc: string|null, time_nyc: string|null, PARTYSIZE_nyc: number|null }}
 */
function parseRequest_nyc(text_nyc) {
  return {
    date_nyc: parseDate_nyc(text_nyc),
    time_nyc: parseTime_nyc(text_nyc),
    PARTYSIZE_nyc: parsePartySize_nyc(text_nyc),
  };
}

const monthMap_nyc = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/**
 * Extracts and normalizes a date from text to YYYY-MM-DD format.
 * Supports: "March 15", "March 15th", "12/25", "2025-04-10"
 */
function parseDate_nyc(text_nyc) {
  // ISO format: YYYY-MM-DD
  const isoMatch_nyc = text_nyc.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch_nyc) {
    return isoMatch_nyc[0];
  }

  // Month name + day: "March 15" or "March 15th"
  const monthNamePattern_nyc = new RegExp(
    `(${Object.keys(monthMap_nyc).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    'i'
  );
  const monthNameMatch_nyc = text_nyc.match(monthNamePattern_nyc);
  if (monthNameMatch_nyc) {
    const monthNum_nyc = monthMap_nyc[monthNameMatch_nyc[1].toLowerCase()];
    const day_nyc = parseInt(monthNameMatch_nyc[2], 10);
    const year_nyc = inferYear_nyc(monthNum_nyc, day_nyc);
    return formatDate_nyc(year_nyc, monthNum_nyc, day_nyc);
  }

  // Numeric format: MM/DD or MM/DD/YYYY
  const numericMatch_nyc = text_nyc.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (numericMatch_nyc) {
    const month_nyc = parseInt(numericMatch_nyc[1], 10);
    const day_nyc = parseInt(numericMatch_nyc[2], 10);
    let year_nyc;
    if (numericMatch_nyc[3]) {
      year_nyc = parseInt(numericMatch_nyc[3], 10);
      if (year_nyc < 100) year_nyc += 2000;
    } else {
      year_nyc = inferYear_nyc(month_nyc, day_nyc);
    }
    return formatDate_nyc(year_nyc, month_nyc, day_nyc);
  }

  return null;
}

/**
 * Infers the year for a month/day combo. Uses the current year,
 * or next year if the date has already passed.
 */
function inferYear_nyc(month_nyc, day_nyc) {
  const now_nyc = new Date();
  const currentYear_nyc = now_nyc.getFullYear();
  const candidate_nyc = new Date(currentYear_nyc, month_nyc - 1, day_nyc);
  if (candidate_nyc < now_nyc) {
    return currentYear_nyc + 1;
  }
  return currentYear_nyc;
}

function formatDate_nyc(year_nyc, month_nyc, day_nyc) {
  const m_nyc = String(month_nyc).padStart(2, '0');
  const d_nyc = String(day_nyc).padStart(2, '0');
  return `${year_nyc}-${m_nyc}-${d_nyc}`;
}

/**
 * Extracts and normalizes a time from text to HH:MM (24-hour) format.
 * Supports: "7pm", "7:30 PM", "19:00"
 */
function parseTime_nyc(text_nyc) {
  // 24-hour format: 19:00
  const time24Match_nyc = text_nyc.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]m)/i);
  if (time24Match_nyc) {
    const hours_nyc = parseInt(time24Match_nyc[1], 10);
    const minutes_nyc = parseInt(time24Match_nyc[2], 10);
    // Only treat as 24-hour if hours >= 13 or the format is unambiguous
    if (hours_nyc >= 13) {
      return `${String(hours_nyc).padStart(2, '0')}:${String(minutes_nyc).padStart(2, '0')}`;
    }
  }

  // 12-hour format with minutes: "7:30 PM", "6:30PM"
  const time12MinMatch_nyc = text_nyc.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (time12MinMatch_nyc) {
    let hours_nyc = parseInt(time12MinMatch_nyc[1], 10);
    const minutes_nyc = parseInt(time12MinMatch_nyc[2], 10);
    const period_nyc = time12MinMatch_nyc[3].toLowerCase();
    if (period_nyc === 'pm' && hours_nyc !== 12) hours_nyc += 12;
    if (period_nyc === 'am' && hours_nyc === 12) hours_nyc = 0;
    return `${String(hours_nyc).padStart(2, '0')}:${String(minutes_nyc).padStart(2, '0')}`;
  }

  // 12-hour format without minutes: "7pm", "7 pm"
  const time12Match_nyc = text_nyc.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (time12Match_nyc) {
    let hours_nyc = parseInt(time12Match_nyc[1], 10);
    const period_nyc = time12Match_nyc[2].toLowerCase();
    if (period_nyc === 'pm' && hours_nyc !== 12) hours_nyc += 12;
    if (period_nyc === 'am' && hours_nyc === 12) hours_nyc = 0;
    return `${String(hours_nyc).padStart(2, '0')}:00`;
  }

  // 24-hour format fallback (for cases like 19:00 that didn't match above due to am/pm check)
  if (time24Match_nyc) {
    const hours_nyc = parseInt(time24Match_nyc[1], 10);
    const minutes_nyc = parseInt(time24Match_nyc[2], 10);
    return `${String(hours_nyc).padStart(2, '0')}:${String(minutes_nyc).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extracts party size from text.
 * Supports: "for 4", "4 people", "party of 4"
 */
function parsePartySize_nyc(text_nyc) {
  // "for X people", "for X"
  const forMatch_nyc = text_nyc.match(/\bfor\s+(\d+)\s*(?:people|persons|guests|diners)?\b/i);
  if (forMatch_nyc) {
    return parseInt(forMatch_nyc[1], 10);
  }

  // "X people/persons/guests"
  const peopleMatch_nyc = text_nyc.match(/\b(\d+)\s+(?:people|persons|guests|diners)\b/i);
  if (peopleMatch_nyc) {
    return parseInt(peopleMatch_nyc[1], 10);
  }

  // "party of X"
  const partyMatch_nyc = text_nyc.match(/\bparty\s+of\s+(\d+)\b/i);
  if (partyMatch_nyc) {
    return parseInt(partyMatch_nyc[1], 10);
  }

  return null;
}

module.exports = { parseRequest_nyc };
