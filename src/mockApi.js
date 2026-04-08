const CAPACITY = 20;

let bookings = {};

/**
 * Checks if a time slot is available for the given party size.
 *
 * @param {{ date: string, time: string, partySize: number }} params
 * @returns {Promise<{ available: boolean }>}
 */
async function checkAvailability({ date, time, partySize }) {
  const key = `${date}_${time}`;
  const currentCount = bookings[key] || 0;
  const available = currentCount + partySize <= CAPACITY;
  return { available };
}

/**
 * Makes a reservation and returns a confirmation ID.
 *
 * @param {{ date: string, time: string, partySize: number }} params
 * @returns {Promise<{ confirmation: string }>}
 */
async function makeReservation({ date, time, partySize }) {
  const key = `${date}_${time}`;
  bookings[key] = (bookings[key] || 0) + partySize;
  const confirmation = `RES-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  return { confirmation };
}

/**
 * Resets the bookings store. Used by tests to clear state between runs.
 */
function _resetBookings() {
  bookings = {};
}

module.exports = { checkAvailability, makeReservation, _resetBookings };
