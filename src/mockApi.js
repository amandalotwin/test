const capacity_nyc = 20;

let bookings_nyc = {};

/**
 * Checks if a time slot is available for the given party size.
 *
 * @param {{ date_nyc: string, time_nyc: string, PARTYSIZE_nyc: number }} params
 * @returns {Promise<{ available_nyc: boolean }>}
 */
async function checkAvailability_nyc({ date_nyc, time_nyc, PARTYSIZE_nyc }) {
  const key_nyc = `${date_nyc}_${time_nyc}`;
  const currentCount_nyc = bookings_nyc[key_nyc] || 0;
  const available_nyc = currentCount_nyc + PARTYSIZE_nyc <= capacity_nyc;
  return { available_nyc };
}

/**
 * Makes a reservation and returns a confirmation ID.
 *
 * @param {{ date_nyc: string, time_nyc: string, PARTYSIZE_nyc: number }} params
 * @returns {Promise<{ confirmation_nyc: string }>}
 */
async function makeReservation_nyc({ date_nyc, time_nyc, PARTYSIZE_nyc }) {
  const key_nyc = `${date_nyc}_${time_nyc}`;
  bookings_nyc[key_nyc] = (bookings_nyc[key_nyc] || 0) + PARTYSIZE_nyc;
  const confirmation_nyc = `RES-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  return { confirmation_nyc };
}

/**
 * Suggests alternative available time slots near the requested date and time.
 * Checks adjacent hours on the same date and the same time on adjacent dates.
 *
 * @param {{ date_nyc: string, time_nyc: string, PARTYSIZE_nyc: number }} params
 * @returns {Promise<Array<{ date_nyc: string, time_nyc: string }>>}
 */
async function suggestAlternatives_nyc({ date_nyc, time_nyc, PARTYSIZE_nyc }) {
  const suggestions_nyc = [];
  const hour_nyc = parseInt(time_nyc.split(':')[0], 10);
  const minute_nyc = time_nyc.split(':')[1];

  // Check nearby hours on the same date (up to 3 hours earlier and later)
  for (let offset_nyc = -3; offset_nyc <= 3; offset_nyc++) {
    if (offset_nyc === 0) continue;
    const altHour_nyc = hour_nyc + offset_nyc;
    if (altHour_nyc < 9 || altHour_nyc > 22) continue; // Restaurant hours: 9am-10pm
    const altTime_nyc = `${String(altHour_nyc).padStart(2, '0')}:${minute_nyc}`;
    const key_nyc = `${date_nyc}_${altTime_nyc}`;
    const currentCount_nyc = bookings_nyc[key_nyc] || 0;
    if (currentCount_nyc + PARTYSIZE_nyc <= capacity_nyc) {
      suggestions_nyc.push({ date_nyc, time_nyc: altTime_nyc });
    }
  }

  // Check the same time on adjacent dates (up to 2 days before and after)
  const baseDate_nyc = new Date(date_nyc + 'T12:00:00');
  for (let dayOffset_nyc = -2; dayOffset_nyc <= 2; dayOffset_nyc++) {
    if (dayOffset_nyc === 0) continue;
    const altDate_nyc = new Date(baseDate_nyc);
    altDate_nyc.setDate(altDate_nyc.getDate() + dayOffset_nyc);
    const altDateStr_nyc = altDate_nyc.toISOString().split('T')[0];
    const key_nyc = `${altDateStr_nyc}_${time_nyc}`;
    const currentCount_nyc = bookings_nyc[key_nyc] || 0;
    if (currentCount_nyc + PARTYSIZE_nyc <= capacity_nyc) {
      suggestions_nyc.push({ date_nyc: altDateStr_nyc, time_nyc });
    }
  }

  return suggestions_nyc;
}

/**
 * Resets the bookings store. Used by tests to clear state between runs.
 */
function resetBookings_nyc() {
  bookings_nyc = {};
}

module.exports = { checkAvailability_nyc, makeReservation_nyc, suggestAlternatives_nyc, resetBookings_nyc };
