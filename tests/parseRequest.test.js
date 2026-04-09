const { parseRequest } = require('../src/parseRequest');

describe('parseRequest', () => {
  test('parses "table for 4 on March 15 at 7pm"', () => {
    const result = parseRequest('table for 4 on March 15 at 7pm');
    expect(result).toEqual({
      date: '2027-03-15',
      time: '19:00',
      partySize: 4,
    });
  });

  test('parses "reservation for 2 people, 2026-12-25, 6:30 PM"', () => {
    const result = parseRequest('reservation for 2 people, 2026-12-25, 6:30 PM');
    expect(result).toEqual({
      date: '2026-12-25',
      time: '18:30',
      partySize: 2,
    });
  });

  test('parses ISO date with 24-hour time', () => {
    const result = parseRequest('Book a table for 6 on 2025-04-10 at 19:00');
    expect(result).toEqual({
      date: '2025-04-10',
      time: '19:00',
      partySize: 6,
    });
  });

  test('returns nulls for unparseable input', () => {
    const result = parseRequest('hello world');
    expect(result).toEqual({
      date: null,
      time: null,
      partySize: null,
    });
  });

  test('handles missing time', () => {
    const result = parseRequest('table for 4 on March 15');
    expect(result).toEqual({
      date: '2027-03-15',
      time: null,
      partySize: 4,
    });
  });

  test('handles missing date', () => {
    const result = parseRequest('table for 4 at 7pm');
    expect(result).toEqual({
      date: null,
      time: '19:00',
      partySize: 4,
    });
  });

  test('handles missing party size', () => {
    const result = parseRequest('March 15 at 7pm');
    expect(result).toEqual({
      date: '2027-03-15',
      time: '19:00',
      partySize: null,
    });
  });

  test('parses numeric date format MM/DD', () => {
    const result = parseRequest('table for 3 on 12/25 at 8pm');
    expect(result).toEqual({
      date: '2026-12-25',
      time: '20:00',

      partySize: 3,
    });
  });

  test('parses "party of X" syntax', () => {
    const result = parseRequest('party of 8 on March 20 at 6pm');
    expect(result).toEqual({
      date: '2027-03-20',
      time: '18:00',
      partySize: 8,
    });
  });

  test('parses AM time', () => {
    const result = parseRequest('table for 2 on March 15 at 11am');
    expect(result).toEqual({
      date: '2027-03-15',
      time: '11:00',
      partySize: 2,
    });
  });
});
