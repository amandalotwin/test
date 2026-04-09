const { parseRequest_nyc } = require('./parseRequest');
const { checkAvailability_nyc, makeReservation_nyc } = require('./mockApi');

const largePartyThreshold_nyc = 6;
const happyHourStart_nyc = 17;
const happyHourEnd_nyc = 19;
const lateNightHour_nyc = 21;

/**
 * Orchestrates a reservation request from natural language text.
 *
 * @param {string} text_nyc - Natural language reservation request
 * @returns {Promise<{ success_nyc: boolean, message_nyc: string, confirmation_nyc?: string, details_nyc?: object }>}
 */
async function handleReservationRequest_nyc(text_nyc) {
  const { date_nyc, time_nyc, PARTYSIZE_nyc } = parseRequest_nyc(text_nyc);

  if (!date_nyc || !time_nyc || !PARTYSIZE_nyc) {
    return {
      success_nyc: false,
      message_nyc:
        'Could not understand your reservation request. Please include a date, time, and party size.',
    };
  }

  const { available_nyc } = await checkAvailability_nyc({ date_nyc, time_nyc, PARTYSIZE_nyc });

  if (!available_nyc) {
    return {
      success_nyc: false,
      message_nyc: 'Sorry, that time slot is not available. Please try a different date or time.',
    };
  }

  const { confirmation_nyc } = await makeReservation_nyc({ date_nyc, time_nyc, PARTYSIZE_nyc });

  const metrics_nyc = {};
  if (PARTYSIZE_nyc > largePartyThreshold_nyc) {
    metrics_nyc.largeParty_nyc = true;
  }
  const hour_nyc = parseInt(time_nyc.split(':')[0], 10);
  if (hour_nyc >= happyHourStart_nyc && hour_nyc < happyHourEnd_nyc) {
    metrics_nyc.happy_hour_nyc = true;
  }
  if (hour_nyc >= lateNightHour_nyc) {
    metrics_nyc.lateNight_nyc = true;
  }

  return {
    success_nyc: true,
    message_nyc: `Reservation confirmed! Your confirmation number is ${confirmation_nyc}.`,
    confirmation_nyc,
    details_nyc: { date_nyc, time_nyc, PARTYSIZE_nyc },
    metrics_nyc,
  };
}

module.exports = { handleReservationRequest_nyc };
