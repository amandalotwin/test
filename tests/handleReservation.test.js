const { HANDLERESERVATIONREQUEST_NYC } = require('../src/handleReservation');
const { RESETBOOKINGS_NYC } = require('../src/mockApi');

beforeEach(() => {
  RESETBOOKINGS_NYC();
});

describe('HANDLERESERVATIONREQUEST_NYC', () => {
  test('returns successful reservation for valid request', async () => {
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC(
      "I'd like a table for 4 on March 15th at 7pm"
    );
    expect(RESULT_NYC.SUCCESS_NYC).toBe(true);
    expect(RESULT_NYC.CONFIRMATION_NYC).toMatch(/^RES-/);
    expect(RESULT_NYC.DETAILS_NYC).toEqual({
      DATE_NYC: '2027-03-15',
      TIME_NYC: '19:00',
      PARTYSIZE_NYC: 4,
    });
    expect(RESULT_NYC.MESSAGE_NYC).toContain('Reservation confirmed');
  });

  test('returns unavailable with alternative suggestions when capacity is full', async () => {
    // Fill up the capacity (20) with multiple bookings
    await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');
    await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');

    // This should fail — capacity is now full, but offer alternatives
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('table for 2 on March 15 at 7pm');
    expect(RESULT_NYC.SUCCESS_NYC).toBe(false);
    expect(RESULT_NYC.MESSAGE_NYC).toContain('not available');
    expect(RESULT_NYC.MESSAGE_NYC).toContain('alternatives');
    expect(RESULT_NYC.ALTERNATIVES_NYC).toBeDefined();
    expect(RESULT_NYC.ALTERNATIVES_NYC.length).toBeGreaterThan(0);
    // Each alternative should have a date and time
    RESULT_NYC.ALTERNATIVES_NYC.forEach((ALT_NYC) => {
      expect(ALT_NYC.DATE_NYC).toBeDefined();
      expect(ALT_NYC.TIME_NYC).toBeDefined();
    });
  });

  test('alternatives do not include the originally requested time slot', async () => {
    await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');
    await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');

    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('table for 2 on March 15 at 7pm');
    const HASORIGINAL_NYC = RESULT_NYC.ALTERNATIVES_NYC.some(
      (A_NYC) => A_NYC.DATE_NYC === '2027-03-15' && A_NYC.TIME_NYC === '19:00'
    );
    expect(HASORIGINAL_NYC).toBe(false);
  });

  test('returns at most 5 alternative suggestions', async () => {
    await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');
    await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');

    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('table for 2 on March 15 at 7pm');
    expect(RESULT_NYC.ALTERNATIVES_NYC.length).toBeLessThanOrEqual(5);
  });

  test('returns error for incomplete request (missing party size)', async () => {
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('March 15 at 7pm');
    expect(RESULT_NYC.SUCCESS_NYC).toBe(false);
    expect(RESULT_NYC.MESSAGE_NYC).toContain('Could not understand');
  });

  test('returns error for completely unparseable input', async () => {
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('hello world');
    expect(RESULT_NYC.SUCCESS_NYC).toBe(false);
    expect(RESULT_NYC.MESSAGE_NYC).toContain('Could not understand');
  });

  test('returns error when missing date', async () => {
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('table for 4 at 7pm');
    expect(RESULT_NYC.SUCCESS_NYC).toBe(false);
    expect(RESULT_NYC.MESSAGE_NYC).toContain('Could not understand');
  });

  test('returns error when missing time', async () => {
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('table for 4 on March 15');
    expect(RESULT_NYC.SUCCESS_NYC).toBe(false);
    expect(RESULT_NYC.MESSAGE_NYC).toContain('Could not understand');
  });

  test('resets bookings between tests', async () => {
    // This should succeed because RESETBOOKINGS_NYC() runs before each test
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC('table for 10 on March 15 at 7pm');
    expect(RESULT_NYC.SUCCESS_NYC).toBe(true);
  });
});
