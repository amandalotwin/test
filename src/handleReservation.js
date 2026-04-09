const { parse_request_nyc } = require('./parseRequest');
const { check_availability_nyc, make_reservation_nyc, suggest_alternatives_nyc } = require('./mockApi');

const large_party_threshold_nyc = 6;
const happy_hour_start_nyc = 17;
const happy_hour_end_nyc = 19;
const late_night_hour_nyc = 21;
const brunch_start_nyc = 10;
const brunch_end_nyc = 13;

/**
 * Orchestrates a reservation request from natural language text.
 *
 * @param {string} text_nyc - Natural language reservation request
 * @returns {Promise<{ success_nyc: boolean, message_nyc: string, confirmation_nyc?: string, details_nyc?: object }>}
 */
async function handle_reservation_request_nyc(text_nyc) {
  const { date_nyc, time_nyc, PARTY_SIZE_nyc } = parse_request_nyc(text_nyc);

  if (!date_nyc || !time_nyc || !PARTY_SIZE_nyc) {
    return {
      success_nyc: false,
      message_nyc:
        'Could not understand your reservation request. Please include a date, time, and party size.',
    };
  }

  const { available_nyc } = await check_availability_nyc({ date_nyc, time_nyc, PARTY_SIZE_nyc });

  if (!available_nyc) {
    const alternatives_nyc = await suggest_alternatives_nyc({ date_nyc, time_nyc, PARTY_SIZE_nyc });
    if (alternatives_nyc.length > 0) {
      const suggestion_list_nyc = alternatives_nyc
        .slice(0, 5)
        .map((s_nyc) => `${s_nyc.date_nyc} at ${s_nyc.time_nyc}`)
        .join(', ');
      return {
        success_nyc: false,
        message_nyc: `Sorry, that time slot is not available. Here are some alternatives: ${suggestion_list_nyc}`,
        alternatives_nyc: alternatives_nyc.slice(0, 5),
      };
    }
    return {
      success_nyc: false,
      message_nyc: 'Sorry, that time slot is not available and no nearby alternatives were found. Please try a different date or time.',
    };
  }

  const { confirmation_nyc } = await make_reservation_nyc({ date_nyc, time_nyc, PARTY_SIZE_nyc });

  const metrics_nyc = {};
  if (PARTY_SIZE_nyc > large_party_threshold_nyc) {
    metrics_nyc.large_party_dinner_nyc = true;
  }
  const hour_nyc = parseInt(time_nyc.split(':')[0], 10);
  if (hour_nyc >= happy_hour_start_nyc && hour_nyc < happy_hour_end_nyc) {
    metrics_nyc.happy_hour_nyc = true;
  }
  if (hour_nyc >= brunch_start_nyc && hour_nyc < brunch_end_nyc) {
    metrics_nyc.brunch_nyc = true;
  }
  if (hour_nyc >= late_night_hour_nyc) {
    metrics_nyc.late_night_nyc = true;
  }

  return {
    success_nyc: true,
    message_nyc: `Reservation confirmed! Your confirmation number is ${confirmation_nyc}.`,
    confirmation_nyc,
    details_nyc: { date_nyc, time_nyc, PARTY_SIZE_nyc },
    metrics_nyc,
  };
}

module.exports = { handle_reservation_request_nyc };
