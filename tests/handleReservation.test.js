const { handleReservationRequest } = require('../src/handleReservation');
const { _resetBookings } = require('../src/mockApi');

beforeEach(() => {
  _resetBookings();
});

describe('handleReservationRequest', () => {
  test('returns successful reservation for valid request', async () => {
    const result = await handleReservationRequest(
      "I'd like a table for 4 on March 15th at 7pm"
    );
    expect(result.success).toBe(true);
    expect(result.confirmation).toMatch(/^RES-/);
    expect(result.details).toEqual({
      date: '2027-03-15',
      time: '19:00',
      partySize: 4,
    });
    expect(result.message).toContain('Reservation confirmed');
  });

  test('returns unavailable when capacity is full', async () => {
    // Fill up the capacity (20) with multiple bookings
    await handleReservationRequest('table for 10 on March 15 at 7pm');
    await handleReservationRequest('table for 10 on March 15 at 7pm');

    // This should fail — capacity is now full
    const result = await handleReservationRequest('table for 2 on March 15 at 7pm');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not available');
  });

  test('returns error for incomplete request (missing party size)', async () => {
    const result = await handleReservationRequest('March 15 at 7pm');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('returns error for completely unparseable input', async () => {
    const result = await handleReservationRequest('hello world');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('returns error when missing date', async () => {
    const result = await handleReservationRequest('table for 4 at 7pm');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('returns error when missing time', async () => {
    const result = await handleReservationRequest('table for 4 on March 15');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('resets bookings between tests', async () => {
    // This should succeed because _resetBookings() runs before each test
    const result = await handleReservationRequest('table for 10 on March 15 at 7pm');
    expect(result.success).toBe(true);
  });
});
