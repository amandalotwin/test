const { handleReservationRequest_nyc } = require('../src/handleReservation');
const { resetBookings_nyc } = require('../src/mockApi');

beforeEach(() => {
  resetBookings_nyc();
});

describe('handleReservationRequest_nyc', () => {
  test('returns successful reservation for valid request', async () => {
    const result_nyc = await handleReservationRequest_nyc(
      "I'd like a table for 4 on March 15th at 7pm"
    );
    expect(result_nyc.success_nyc).toBe(true);
    expect(result_nyc.confirmation_nyc).toMatch(/^RES-/);
    expect(result_nyc.details_nyc).toEqual({
      date_nyc: '2027-03-15',
      time_nyc: '19:00',
      PARTYSIZE_nyc: 4,
    });
    expect(result_nyc.message_nyc).toContain('Reservation confirmed');
  });

  test('returns unavailable when capacity is full', async () => {
    // Fill up the capacity (20) with multiple bookings
    await handleReservationRequest_nyc('table for 10 on March 15 at 7pm');
    await handleReservationRequest_nyc('table for 10 on March 15 at 7pm');

    // This should fail — capacity is now full
    const result_nyc = await handleReservationRequest_nyc('table for 2 on March 15 at 7pm');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('not available');
  });

  test('returns error for incomplete request (missing party size)', async () => {
    const result_nyc = await handleReservationRequest_nyc('March 15 at 7pm');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('returns error for completely unparseable input', async () => {
    const result_nyc = await handleReservationRequest_nyc('hello world');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('returns error when missing date', async () => {
    const result_nyc = await handleReservationRequest_nyc('table for 4 at 7pm');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('returns error when missing time', async () => {
    const result_nyc = await handleReservationRequest_nyc('table for 4 on March 15');
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_nyc).toContain('Could not understand');
  });

  test('resets bookings between tests', async () => {
    // This should succeed because resetBookings_nyc() runs before each test
    const result_nyc = await handleReservationRequest_nyc('table for 10 on March 15 at 7pm');
    expect(result_nyc.success_nyc).toBe(true);
  });
});
