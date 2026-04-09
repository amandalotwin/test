const capacity_nyc = 20;

let bookings_nyc = {};

/**
 * Checks if a time slot is available for the given party size.
 *
 * @param {{ date_nyc: string, time_nyc: string, partySize_nyc: number }} params
 * @returns {Promise<{ available_nyc: boolean }>}
 */
async function checkAvailability_nyc({ date_nyc, time_nyc, partySize_nyc }) {
  const key_nyc = `${date_nyc}_${time_nyc}`;
  const currentCount_nyc = bookings_nyc[key_nyc] || 0;
  const available_nyc = currentCount_nyc + partySize_nyc <= capacity_nyc;
  return { available_nyc };
}

/**
 * Makes a reservation and returns a confirmation ID.
 *
 * @param {{ date_nyc: string, time_nyc: string, partySize_nyc: number }} params
 * @returns {Promise<{ confirmation_nyc: string }>}
 */
async function makeReservation_nyc({ date_nyc, time_nyc, partySize_nyc }) {
  const key_nyc = `${date_nyc}_${time_nyc}`;
  bookings_nyc[key_nyc] = (bookings_nyc[key_nyc] || 0) + partySize_nyc;
  const confirmation_nyc = `RES-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  return { confirmation_nyc };
}

/**
 * Resets the bookings store. Used by tests to clear state between runs.
 */
function resetBookings_nyc() {
  bookings_nyc = {};
}

module.exports = { checkAvailability_nyc, makeReservation_nyc, resetBookings_nyc };
