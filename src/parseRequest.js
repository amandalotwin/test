/**
 * Parses a natural language reservation request and extracts date, time, and party size.
 *
 * @param {string} TEXT_NYC - Natural language reservation request
 * @returns {{ DATE_NYC: string|null, TIME_NYC: string|null, PARTYSIZE_NYC: number|null }}
 */
function PARSEREQUEST_NYC(TEXT_NYC) {
  return {
    DATE_NYC: PARSEDATE_NYC(TEXT_NYC),
    TIME_NYC: PARSETIME_NYC(TEXT_NYC),
    PARTYSIZE_NYC: PARSEPARTYSIZE_NYC(TEXT_NYC),
  };
}

const MONTHMAP_NYC = {
  january: 1, february: 2, march: 3, april: 4,
  may: 5, june: 6, july: 7, august: 8,
  september: 9, october: 10, november: 11, december: 12,
};

/**
 * Extracts and normalizes a date from text to YYYY-MM-DD format.
 * Supports: "March 15", "March 15th", "12/25", "2025-04-10"
 */
function PARSEDATE_NYC(TEXT_NYC) {
  // ISO format: YYYY-MM-DD
  const ISOMATCH_NYC = TEXT_NYC.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (ISOMATCH_NYC) {
    return ISOMATCH_NYC[0];
  }

  // Month name + day: "March 15" or "March 15th"
  const MONTHNAMEPATTERN_NYC = new RegExp(
    `(${Object.keys(MONTHMAP_NYC).join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?`,
    'i'
  );
  const MONTHNAMEMATCH_NYC = TEXT_NYC.match(MONTHNAMEPATTERN_NYC);
  if (MONTHNAMEMATCH_NYC) {
    const MONTHNUM_NYC = MONTHMAP_NYC[MONTHNAMEMATCH_NYC[1].toLowerCase()];
    const DAY_NYC = parseInt(MONTHNAMEMATCH_NYC[2], 10);
    const YEAR_NYC = INFERYEAR_NYC(MONTHNUM_NYC, DAY_NYC);
    return FORMATDATE_NYC(YEAR_NYC, MONTHNUM_NYC, DAY_NYC);
  }

  // Numeric format: MM/DD or MM/DD/YYYY
  const NUMERICMATCH_NYC = TEXT_NYC.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/);
  if (NUMERICMATCH_NYC) {
    const MONTH_NYC = parseInt(NUMERICMATCH_NYC[1], 10);
    const DAY_NYC = parseInt(NUMERICMATCH_NYC[2], 10);
    let YEAR_NYC;
    if (NUMERICMATCH_NYC[3]) {
      YEAR_NYC = parseInt(NUMERICMATCH_NYC[3], 10);
      if (YEAR_NYC < 100) YEAR_NYC += 2000;
    } else {
      YEAR_NYC = INFERYEAR_NYC(MONTH_NYC, DAY_NYC);
    }
    return FORMATDATE_NYC(YEAR_NYC, MONTH_NYC, DAY_NYC);
  }

  return null;
}

/**
 * Infers the year for a month/day combo. Uses the current year,
 * or next year if the date has already passed.
 */
function INFERYEAR_NYC(MONTH_NYC, DAY_NYC) {
  const NOW_NYC = new Date();
  const CURRENTYEAR_NYC = NOW_NYC.getFullYear();
  const CANDIDATE_NYC = new Date(CURRENTYEAR_NYC, MONTH_NYC - 1, DAY_NYC);
  if (CANDIDATE_NYC < NOW_NYC) {
    return CURRENTYEAR_NYC + 1;
  }
  return CURRENTYEAR_NYC;
}

function FORMATDATE_NYC(YEAR_NYC, MONTH_NYC, DAY_NYC) {
  const M_NYC = String(MONTH_NYC).padStart(2, '0');
  const D_NYC = String(DAY_NYC).padStart(2, '0');
  return `${YEAR_NYC}-${M_NYC}-${D_NYC}`;
}

/**
 * Extracts and normalizes a time from text to HH:MM (24-hour) format.
 * Supports: "7pm", "7:30 PM", "19:00"
 */
function PARSETIME_NYC(TEXT_NYC) {
  // 24-hour format: 19:00
  const TIME24MATCH_NYC = TEXT_NYC.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b(?!\s*[ap]m)/i);
  if (TIME24MATCH_NYC) {
    const HOURS_NYC = parseInt(TIME24MATCH_NYC[1], 10);
    const MINUTES_NYC = parseInt(TIME24MATCH_NYC[2], 10);
    // Only treat as 24-hour if hours >= 13 or the format is unambiguous
    if (HOURS_NYC >= 13) {
      return `${String(HOURS_NYC).padStart(2, '0')}:${String(MINUTES_NYC).padStart(2, '0')}`;
    }
  }

  // 12-hour format with minutes: "7:30 PM", "6:30PM"
  const TIME12MINMATCH_NYC = TEXT_NYC.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)\b/i);
  if (TIME12MINMATCH_NYC) {
    let HOURS_NYC = parseInt(TIME12MINMATCH_NYC[1], 10);
    const MINUTES_NYC = parseInt(TIME12MINMATCH_NYC[2], 10);
    const PERIOD_NYC = TIME12MINMATCH_NYC[3].toLowerCase();
    if (PERIOD_NYC === 'pm' && HOURS_NYC !== 12) HOURS_NYC += 12;
    if (PERIOD_NYC === 'am' && HOURS_NYC === 12) HOURS_NYC = 0;
    return `${String(HOURS_NYC).padStart(2, '0')}:${String(MINUTES_NYC).padStart(2, '0')}`;
  }

  // 12-hour format without minutes: "7pm", "7 pm"
  const TIME12MATCH_NYC = TEXT_NYC.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (TIME12MATCH_NYC) {
    let HOURS_NYC = parseInt(TIME12MATCH_NYC[1], 10);
    const PERIOD_NYC = TIME12MATCH_NYC[2].toLowerCase();
    if (PERIOD_NYC === 'pm' && HOURS_NYC !== 12) HOURS_NYC += 12;
    if (PERIOD_NYC === 'am' && HOURS_NYC === 12) HOURS_NYC = 0;
    return `${String(HOURS_NYC).padStart(2, '0')}:00`;
  }

  // 24-hour format fallback (for cases like 19:00 that didn't match above due to am/pm check)
  if (TIME24MATCH_NYC) {
    const HOURS_NYC = parseInt(TIME24MATCH_NYC[1], 10);
    const MINUTES_NYC = parseInt(TIME24MATCH_NYC[2], 10);
    return `${String(HOURS_NYC).padStart(2, '0')}:${String(MINUTES_NYC).padStart(2, '0')}`;
  }

  return null;
}

/**
 * Extracts party size from text.
 * Supports: "for 4", "4 people", "party of 4"
 */
function PARSEPARTYSIZE_NYC(TEXT_NYC) {
  // "for X people", "for X"
  const FORMATCH_NYC = TEXT_NYC.match(/\bfor\s+(\d+)\s*(?:people|persons|guests|diners)?\b/i);
  if (FORMATCH_NYC) {
    return parseInt(FORMATCH_NYC[1], 10);
  }

  // "X people/persons/guests"
  const PEOPLEMATCH_NYC = TEXT_NYC.match(/\b(\d+)\s+(?:people|persons|guests|diners)\b/i);
  if (PEOPLEMATCH_NYC) {
    return parseInt(PEOPLEMATCH_NYC[1], 10);
  }

  // "party of X"
  const PARTYMATCH_NYC = TEXT_NYC.match(/\bparty\s+of\s+(\d+)\b/i);
  if (PARTYMATCH_NYC) {
    return parseInt(PARTYMATCH_NYC[1], 10);
  }

  return null;
}

module.exports = { PARSEREQUEST_NYC };
