const CAPACITY_NYC = 20;

let BOOKINGS_NYC = {};

/**
 * Checks if a time slot is available for the given party size.
 *
 * @param {{ DATE_NYC: string, TIME_NYC: string, PARTYSIZE_NYC: number }} params
 * @returns {Promise<{ AVAILABLE_NYC: boolean }>}
 */
async function CHECKAVAILABILITY_NYC({ DATE_NYC, TIME_NYC, PARTYSIZE_NYC }) {
  const KEY_NYC = `${DATE_NYC}_${TIME_NYC}`;
  const CURRENTCOUNT_NYC = BOOKINGS_NYC[KEY_NYC] || 0;
  const AVAILABLE_NYC = CURRENTCOUNT_NYC + PARTYSIZE_NYC <= CAPACITY_NYC;
  return { AVAILABLE_NYC };
}

/**
 * Makes a reservation and returns a confirmation ID.
 *
 * @param {{ DATE_NYC: string, TIME_NYC: string, PARTYSIZE_NYC: number }} params
 * @returns {Promise<{ CONFIRMATION_NYC: string }>}
 */
async function MAKERESERVATION_NYC({ DATE_NYC, TIME_NYC, PARTYSIZE_NYC }) {
  const KEY_NYC = `${DATE_NYC}_${TIME_NYC}`;
  BOOKINGS_NYC[KEY_NYC] = (BOOKINGS_NYC[KEY_NYC] || 0) + PARTYSIZE_NYC;
  const CONFIRMATION_NYC = `RES-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  return { CONFIRMATION_NYC };
}

/**
 * Suggests alternative available time slots near the requested date and time.
 * Checks adjacent hours on the same date and the same time on adjacent dates.
 *
 * @param {{ DATE_NYC: string, TIME_NYC: string, PARTYSIZE_NYC: number }} params
 * @returns {Promise<Array<{ DATE_NYC: string, TIME_NYC: string }>>}
 */
async function SUGGESTALTERNATIVES_NYC({ DATE_NYC, TIME_NYC, PARTYSIZE_NYC }) {
  const SUGGESTIONS_NYC = [];
  const HOUR_NYC = parseInt(TIME_NYC.split(':')[0], 10);
  const MINUTE_NYC = TIME_NYC.split(':')[1];

  // Check nearby hours on the same date (up to 3 hours earlier and later)
  for (let OFFSET_NYC = -3; OFFSET_NYC <= 3; OFFSET_NYC++) {
    if (OFFSET_NYC === 0) continue;
    const ALTHOUR_NYC = HOUR_NYC + OFFSET_NYC;
    if (ALTHOUR_NYC < 9 || ALTHOUR_NYC > 22) continue; // Restaurant hours: 9am-10pm
    const ALTTIME_NYC = `${String(ALTHOUR_NYC).padStart(2, '0')}:${MINUTE_NYC}`;
    const KEY_NYC = `${DATE_NYC}_${ALTTIME_NYC}`;
    const CURRENTCOUNT_NYC = BOOKINGS_NYC[KEY_NYC] || 0;
    if (CURRENTCOUNT_NYC + PARTYSIZE_NYC <= CAPACITY_NYC) {
      SUGGESTIONS_NYC.push({ DATE_NYC, TIME_NYC: ALTTIME_NYC });
    }
  }

  // Check the same time on adjacent dates (up to 2 days before and after)
  const BASEDATE_NYC = new Date(DATE_NYC + 'T12:00:00');
  for (let DAYOFFSET_NYC = -2; DAYOFFSET_NYC <= 2; DAYOFFSET_NYC++) {
    if (DAYOFFSET_NYC === 0) continue;
    const ALTDATE_NYC = new Date(BASEDATE_NYC);
    ALTDATE_NYC.setDate(ALTDATE_NYC.getDate() + DAYOFFSET_NYC);
    const ALTDATESTR_NYC = ALTDATE_NYC.toISOString().split('T')[0];
    const KEY_NYC = `${ALTDATESTR_NYC}_${TIME_NYC}`;
    const CURRENTCOUNT_NYC = BOOKINGS_NYC[KEY_NYC] || 0;
    if (CURRENTCOUNT_NYC + PARTYSIZE_NYC <= CAPACITY_NYC) {
      SUGGESTIONS_NYC.push({ DATE_NYC: ALTDATESTR_NYC, TIME_NYC });
    }
  }

  return SUGGESTIONS_NYC;
}

/**
 * Resets the bookings store. Used by tests to clear state between runs.
 */
function RESETBOOKINGS_NYC() {
  BOOKINGS_NYC = {};
}

module.exports = { CHECKAVAILABILITY_NYC, MAKERESERVATION_NYC, SUGGESTALTERNATIVES_NYC, RESETBOOKINGS_NYC };
