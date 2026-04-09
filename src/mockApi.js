const capacity = 20;

let bookings = {};

/**
 * Checks if a time slot is available for the given party size.
 *
 * @param {{ date: string, time: string, party_size: number }} params
 * @returns {Promise<{ available: boolean }>}
 */
async function check_availability({ date, time, party_size }) {
  const key = `${date}_${time}`;
  const current_count = bookings[key] || 0;
  const available = current_count + party_size <= capacity;
  return { available };
}

/**
 * Makes a reservation and returns a confirmation ID.
 *
 * @param {{ date: string, time: string, party_size: number }} params
 * @returns {Promise<{ confirmation: string }>}
 */
async function make_reservation({ date, time, party_size }) {
  const key = `${date}_${time}`;
  bookings[key] = (bookings[key] || 0) + party_size;
  const confirmation = `RES-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  return { confirmation };
}

/**
 * Resets the bookings store. Used by tests to clear state between runs.
 */
function reset_bookings() {
  bookings = {};
}

module.exports = { check_availability, make_reservation, reset_bookings };
