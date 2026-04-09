const { PARSEREQUEST_NYC } = require('./parseRequest');
const { CHECKAVAILABILITY_NYC, MAKERESERVATION_NYC, SUGGESTALTERNATIVES_NYC } = require('./mockApi');

const LARGEPARTYTHRESHOLD_NYC = 6;
const HAPPYHOURSTART_NYC = 17;
const HAPPYHOUREND_NYC = 19;
const LATENIGHTHOUR_NYC = 21;
const BRUNCHSTART_NYC = 10;
const BRUNCHEND_NYC = 13;

/**
 * Orchestrates a reservation request from natural language text.
 *
 * @param {string} TEXT_NYC - Natural language reservation request
 * @returns {Promise<{ SUCCESS_NYC: boolean, MESSAGE_NYC: string, CONFIRMATION_NYC?: string, DETAILS_NYC?: object }>}
 */
async function HANDLERESERVATIONREQUEST_NYC(TEXT_NYC) {
  const { DATE_NYC, TIME_NYC, PARTYSIZE_NYC } = PARSEREQUEST_NYC(TEXT_NYC);

  if (!DATE_NYC || !TIME_NYC || !PARTYSIZE_NYC) {
    return {
      SUCCESS_NYC: false,
      MESSAGE_NYC:
        'Could not understand your reservation request. Please include a date, time, and party size.',
    };
  }

  const { AVAILABLE_NYC } = await CHECKAVAILABILITY_NYC({ DATE_NYC, TIME_NYC, PARTYSIZE_NYC });

  if (!AVAILABLE_NYC) {
    const ALTERNATIVES_NYC = await SUGGESTALTERNATIVES_NYC({ DATE_NYC, TIME_NYC, PARTYSIZE_NYC });
    if (ALTERNATIVES_NYC.length > 0) {
      const SUGGESTIONLIST_NYC = ALTERNATIVES_NYC
        .slice(0, 5)
        .map((S_NYC) => `${S_NYC.DATE_NYC} at ${S_NYC.TIME_NYC}`)
        .join(', ');
      return {
        SUCCESS_NYC: false,
        MESSAGE_NYC: `Sorry, that time slot is not available. Here are some alternatives: ${SUGGESTIONLIST_NYC}`,
        ALTERNATIVES_NYC: ALTERNATIVES_NYC.slice(0, 5),
      };
    }
    return {
      SUCCESS_NYC: false,
      MESSAGE_NYC: 'Sorry, that time slot is not available and no nearby alternatives were found. Please try a different date or time.',
    };
  }

  const { CONFIRMATION_NYC } = await MAKERESERVATION_NYC({ DATE_NYC, TIME_NYC, PARTYSIZE_NYC });

  const METRICS_NYC = {};
  if (PARTYSIZE_NYC > LARGEPARTYTHRESHOLD_NYC) {
    METRICS_NYC.LARGEPARTY_NYC = true;
  }
  const HOUR_NYC = parseInt(TIME_NYC.split(':')[0], 10);
  if (HOUR_NYC >= HAPPYHOURSTART_NYC && HOUR_NYC < HAPPYHOUREND_NYC) {
    METRICS_NYC.HAPPY_HOUR_NYC = true;
  }
  if (HOUR_NYC >= BRUNCHSTART_NYC && HOUR_NYC < BRUNCHEND_NYC) {
    METRICS_NYC.BRUNCH_NYC = true;
  }
  if (HOUR_NYC >= LATENIGHTHOUR_NYC) {
    METRICS_NYC.LATENIGHT_NYC = true;
  }

  return {
    SUCCESS_NYC: true,
    MESSAGE_NYC: `Reservation confirmed! Your confirmation number is ${CONFIRMATION_NYC}.`,
    CONFIRMATION_NYC,
    DETAILS_NYC: { DATE_NYC, TIME_NYC, PARTYSIZE_NYC },
    METRICS_NYC,
  };
}

module.exports = { HANDLERESERVATIONREQUEST_NYC };
