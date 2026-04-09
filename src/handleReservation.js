const { parseRequest } = require('./parseRequest');
const { checkAvailability, makeReservation } = require('./mockApi');

const largePartyThreshold = 6;

/**
 * Orchestrates a reservation request from natural language text.
 *
 * @param {string} text - Natural language reservation request
 * @returns {Promise<{ success: boolean, message: string, confirmation?: string, details?: object }>}
 */
async function handleReservationRequest(text) {
  const { date, time, partySize } = parseRequest(text);

  if (!date || !time || !partySize) {
    return {
      success: false,
      message:
        'Could not understand your reservation request. Please include a date, time, and party size.',
    };
  }

  const { available } = await checkAvailability({ date, time, partySize });

  if (!available) {
    return {
      success: false,
      message: 'Sorry, that time slot is not available. Please try a different date or time.',
    };
  }

  const { confirmation } = await makeReservation({ date, time, partySize });

  const metrics = {};
  if (partySize > largePartyThreshold) {
    metrics.largeParty = true;
  }

  return {
    success: true,
    message: `Reservation confirmed! Your confirmation number is ${confirmation}.`,
    confirmation,
    details: { date, time, partySize },
    metrics,
  };
}

module.exports = { handleReservationRequest };
