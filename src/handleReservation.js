const { parse_request } = require('./parseRequest');
const { check_availability, make_reservation } = require('./mockApi');

const large_party_threshold = 6;

/**
 * Orchestrates a reservation request from natural language text.
 *
 * @param {string} text - Natural language reservation request
 * @returns {Promise<{ success: boolean, message: string, confirmation?: string, details?: object }>}
 */
async function handle_reservation_request(text) {
  const { date, time, party_size } = parse_request(text);

  if (!date || !time || !party_size) {
    return {
      success: false,
      message:
        'Could not understand your reservation request. Please include a date, time, and party size.',
    };
  }

  const { available } = await check_availability({ date, time, party_size });

  if (!available) {
    return {
      success: false,
      message: 'Sorry, that time slot is not available. Please try a different date or time.',
    };
  }

  const { confirmation } = await make_reservation({ date, time, party_size });

  const metrics = {};
  if (party_size > large_party_threshold) {
    metrics.large_party = true;
  }

  return {
    success: true,
    message: `Reservation confirmed! Your confirmation number is ${confirmation}.`,
    confirmation,
    details: { date, time, party_size },
    metrics,
  };
}

module.exports = { handle_reservation_request };
