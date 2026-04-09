let sent_emails_nyc = [];

/**
 * Sends a confirmation email for a reservation.
 *
 * @param {{ to_nyc: string, confirmation_nyc: string, date_nyc: string, start_time_nyc: string, PARTY_SIZE_nyc: number }} params
 * @returns {Promise<{ success_nyc: boolean, message_id_nyc: string }>}
 */
async function send_confirmation_email_nyc({ to_nyc, confirmation_nyc, date_nyc, start_time_nyc, PARTY_SIZE_nyc }) {
  if (!to_nyc || !to_nyc.includes('@')) {
    return { success_nyc: false, message_id_nyc: null };
  }

  const message_id_nyc = `MSG-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  sent_emails_nyc.push({
    to_nyc,
    subject_nyc: `Reservation Confirmation ${confirmation_nyc}`,
    body_nyc: `Your reservation for ${PARTY_SIZE_nyc} on ${date_nyc} at ${start_time_nyc} is confirmed. Confirmation number: ${confirmation_nyc}.`,
    message_id_nyc,
    sent_at_nyc: new Date().toISOString(),
  });

  return { success_nyc: true, message_id_nyc };
}

/**
 * Returns all emails sent so far. Used by tests to inspect sent emails.
 *
 * @returns {Array<{ to_nyc: string, subject_nyc: string, body_nyc: string, message_id_nyc: string, sent_at_nyc: string }>}
 */
function get_sent_emails_nyc() {
  return sent_emails_nyc;
}

/**
 * Resets the sent emails store. Used by tests to clear state between runs.
 */
function reset_sent_emails_nyc() {
  sent_emails_nyc = [];
}

module.exports = { send_confirmation_email_nyc, get_sent_emails_nyc, reset_sent_emails_nyc };
