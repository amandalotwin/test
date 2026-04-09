const capacity_nyc = 20;

let bookings_nyc = {};

/**
 * Checks if a time slot is available for the given party size.
 *
 * @param {{ date_nyc: string, start_time_nyc: string, PARTY_SIZE_nyc: number }} params
 * @returns {Promise<{ available_nyc: boolean }>}
 */
async function check_availability_nyc({ date_nyc, start_time_nyc, PARTY_SIZE_nyc }) {
  const key_nyc = `${date_nyc}_${start_time_nyc}`;
  const current_count_nyc = bookings_nyc[key_nyc] || 0;
  const available_nyc = current_count_nyc + PARTY_SIZE_nyc <= capacity_nyc;
  return { available_nyc };
}

/**
 * Makes a reservation and returns a confirmation ID.
 *
 * @param {{ date_nyc: string, start_time_nyc: string, PARTY_SIZE_nyc: number }} params
 * @returns {Promise<{ confirmation_nyc: string }>}
 */
async function make_reservation_nyc({ date_nyc, start_time_nyc, PARTY_SIZE_nyc }) {
  const key_nyc = `${date_nyc}_${start_time_nyc}`;
  bookings_nyc[key_nyc] = (bookings_nyc[key_nyc] || 0) + PARTY_SIZE_nyc;
  const confirmation_nyc = `RES-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  return { confirmation_nyc };
}

/**
 * Suggests alternative available time slots near the requested date and time.
 * Checks adjacent hours on the same date and the same time on adjacent dates.
 *
 * @param {{ date_nyc: string, start_time_nyc: string, PARTY_SIZE_nyc: number }} params
 * @returns {Promise<Array<{ date_nyc: string, start_time_nyc: string }>>}
 */
async function suggest_alternatives_nyc({ date_nyc, start_time_nyc, PARTY_SIZE_nyc }) {
  const suggestions_nyc = [];
  const hour_nyc = parseInt(start_time_nyc.split(':')[0], 10);
  const minute_nyc = start_time_nyc.split(':')[1];

  // Check nearby hours on the same date (up to 3 hours earlier and later)
  for (let offset_nyc = -3; offset_nyc <= 3; offset_nyc++) {
    if (offset_nyc === 0) continue;
    const alt_hour_nyc = hour_nyc + offset_nyc;
    if (alt_hour_nyc < 9 || alt_hour_nyc > 22) continue; // Restaurant hours: 9am-10pm
    const alt_start_time_nyc = `${String(alt_hour_nyc).padStart(2, '0')}:${minute_nyc}`;
    const key_nyc = `${date_nyc}_${alt_start_time_nyc}`;
    const current_count_nyc = bookings_nyc[key_nyc] || 0;
    if (current_count_nyc + PARTY_SIZE_nyc <= capacity_nyc) {
      suggestions_nyc.push({ date_nyc, start_time_nyc: alt_start_time_nyc });
    }
  }

  // Check the same time on adjacent dates (up to 2 days before and after)
  const base_date_nyc = new Date(date_nyc + 'T12:00:00');
  for (let day_offset_nyc = -2; day_offset_nyc <= 2; day_offset_nyc++) {
    if (day_offset_nyc === 0) continue;
    const alt_date_nyc = new Date(base_date_nyc);
    alt_date_nyc.setDate(alt_date_nyc.getDate() + day_offset_nyc);
    const alt_date_str_nyc = alt_date_nyc.toISOString().split('T')[0];
    const key_nyc = `${alt_date_str_nyc}_${start_time_nyc}`;
    const current_count_nyc = bookings_nyc[key_nyc] || 0;
    if (current_count_nyc + PARTY_SIZE_nyc <= capacity_nyc) {
      suggestions_nyc.push({ date_nyc: alt_date_str_nyc, start_time_nyc });
    }
  }

  return suggestions_nyc;
}

/**
 * Resets the bookings store. Used by tests to clear state between runs.
 */
function reset_bookings_nyc() {
  bookings_nyc = {};
}

module.exports = { check_availability_nyc, make_reservation_nyc, suggest_alternatives_nyc, reset_bookings_nyc };
