const { handle_reservation_request } = require('../src/handleReservation');
const { reset_bookings } = require('../src/mockApi');

beforeEach(() => {
  reset_bookings();
});

describe('handle_reservation_request', () => {
  test('returns successful reservation for valid request', async () => {
    const result = await handle_reservation_request(
      "I'd like a table for 4 on March 15th at 7pm"
    );
    expect(result.success).toBe(true);
    expect(result.confirmation).toMatch(/^RES-/);
    expect(result.details).toEqual({
      date: '2027-03-15',
      time: '19:00',
      party_size: 4,
    });
    expect(result.message).toContain('Reservation confirmed');
  });

  test('returns unavailable when capacity is full', async () => {
    // Fill up the capacity (20) with multiple bookings
    await handle_reservation_request('table for 10 on March 15 at 7pm');
    await handle_reservation_request('table for 10 on March 15 at 7pm');

    // This should fail — capacity is now full
    const result = await handle_reservation_request('table for 2 on March 15 at 7pm');
    expect(result.success).toBe(false);
    expect(result.message).toContain('not available');
  });

  test('returns error for incomplete request (missing party size)', async () => {
    const result = await handle_reservation_request('March 15 at 7pm');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('returns error for completely unparseable input', async () => {
    const result = await handle_reservation_request('hello world');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('returns error when missing date', async () => {
    const result = await handle_reservation_request('table for 4 at 7pm');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('returns error when missing time', async () => {
    const result = await handle_reservation_request('table for 4 on March 15');
    expect(result.success).toBe(false);
    expect(result.message).toContain('Could not understand');
  });

  test('resets bookings between tests', async () => {
    // This should succeed because reset_bookings() runs before each test
    const result = await handle_reservation_request('table for 10 on March 15 at 7pm');
    expect(result.success).toBe(true);
  });
});
