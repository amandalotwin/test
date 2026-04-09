const { handle_reservation_request_nyc } = require('../src/handleReservation');
const { reset_bookings_nyc } = require('../src/mockApi');
const { get_sent_emails_nyc, reset_sent_emails_nyc } = require('../src/mockEmailApi');

beforeEach(() => {
  reset_bookings_nyc();
  reset_sent_emails_nyc();
});

describe('handle_reservation_request_nyc', () => {
  test('returns successful reservation for valid request', async () => {
    const result_nyc = await handle_reservation_request_nyc(
      "I'd like a table for 4 on March 15th at 7pm"
    );
    expect(result_nyc.success_nyc).toBe(true);
    expect(result_nyc.confirmation_nyc).toMatch(/^RES-/);
    expect(result_nyc.details_nyc).toEqual({
      date_nyc: '2027-03-15',
      time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
    expect(result_nyc.message_nyc).toContain('Reservation confirmed');
  });

  test('returns unavailable with alternative suggestions when capacity is full', async () => {
    // Fill up the capacity (20) with multiple bookings
    await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');
    await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');

    // This should fail — capacity is now full, but offer alternatives
    const result_nyc = await handle_reservation_request_nyc('table for 2 on March 15 at 7pm');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('not available');
    expect(result_nyc.message_nyc).toContain('alternatives');
    expect(result_nyc.alternatives_nyc).toBeDefined();
    expect(result_nyc.alternatives_nyc.length).toBeGreaterThan(0);
    // Each alternative should have a date and time
    result_nyc.alternatives_nyc.forEach((alt_nyc) => {
      expect(alt_nyc.date_nyc).toBeDefined();
      expect(alt_nyc.time_nyc).toBeDefined();
    });
  });

  test('alternatives do not include the originally requested time slot', async () => {
    await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');
    await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');

    const result_nyc = await handle_reservation_request_nyc('table for 2 on March 15 at 7pm');
    const has_original_nyc = result_nyc.alternatives_nyc.some(
      (a_nyc) => a_nyc.date_nyc === '2027-03-15' && a_nyc.time_nyc === '19:00'
    );
    expect(has_original_nyc).toBe(false);
  });

  test('returns at most 5 alternative suggestions', async () => {
    await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');
    await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');

    const result_nyc = await handle_reservation_request_nyc('table for 2 on March 15 at 7pm');
    expect(result_nyc.alternatives_nyc.length).toBeLessThanOrEqual(5);
  });

  test('returns error for incomplete request (missing party size)', async () => {
    const result_nyc = await handle_reservation_request_nyc('March 15 at 7pm');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('returns error for completely unparseable input', async () => {
    const result_nyc = await handle_reservation_request_nyc('hello world');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('returns error when missing date', async () => {
    const result_nyc = await handle_reservation_request_nyc('table for 4 at 7pm');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('returns error when missing time', async () => {
    const result_nyc = await handle_reservation_request_nyc('table for 4 on March 15');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('resets bookings between tests', async () => {
    // This should succeed because reset_bookings_nyc() runs before each test
    const result_nyc = await handle_reservation_request_nyc('table for 10 on March 15 at 7pm');
    expect(result_nyc.success_nyc).toBe(true);
  });

  test('sends confirmation email when email is provided', async () => {
    const result_nyc = await handle_reservation_request_nyc(
      'table for 4 on March 15 at 7pm',
      { email_nyc: 'guest@example.com' }
    );
    expect(result_nyc.success_nyc).toBe(true);
    expect(result_nyc.email_sent_nyc).toBe(true);

    const emails_nyc = get_sent_emails_nyc();
    expect(emails_nyc.length).toBe(1);
    expect(emails_nyc[0].to_nyc).toBe('guest@example.com');
    expect(emails_nyc[0].subject_nyc).toContain(result_nyc.confirmation_nyc);
    expect(emails_nyc[0].body_nyc).toContain('2027-03-15');
    expect(emails_nyc[0].body_nyc).toContain('19:00');
  });

  test('does not send email when no email is provided', async () => {
    const result_nyc = await handle_reservation_request_nyc(
      'table for 4 on March 15 at 7pm'
    );
    expect(result_nyc.success_nyc).toBe(true);
    expect(result_nyc.email_sent_nyc).toBe(false);
    expect(get_sent_emails_nyc().length).toBe(0);
  });

  test('sets email_sent_nyc to false for invalid email', async () => {
    const result_nyc = await handle_reservation_request_nyc(
      'table for 4 on March 15 at 7pm',
      { email_nyc: 'not-an-email' }
    );
    expect(result_nyc.success_nyc).toBe(true);
    expect(result_nyc.email_sent_nyc).toBe(false);
  });

  test('does not send email when reservation fails', async () => {
    const result_nyc = await handle_reservation_request_nyc(
      'hello world',
      { email_nyc: 'guest@example.com' }
    );
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.email_sent_nyc).toBeUndefined();
    expect(get_sent_emails_nyc().length).toBe(0);
  });
});
