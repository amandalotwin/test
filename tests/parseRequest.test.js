const { parse_request_nyc } = require('../src/parseRequest');

describe('parse_request_nyc', () => {
  test('parses "table for 4 on March 15 at 7pm"', () => {
    const result_nyc = parse_request_nyc('table for 4 on March 15 at 7pm');
    expect(result_nyc).toEqual({
      date_nyc: '2027-03-15',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
  });

  test('parses "reservation for 2 people, 2026-12-25, 6:30 PM"', () => {
    const result_nyc = parse_request_nyc('reservation for 2 people, 2026-12-25, 6:30 PM');
    expect(result_nyc).toEqual({
      date_nyc: '2026-12-25',
      start_time_nyc: '18:30',
      PARTY_SIZE_nyc: 2,
    });
  });

  test('parses ISO date with 24-hour time', () => {
    const result_nyc = parse_request_nyc('Book a table for 6 on 2025-04-10 at 19:00');
    expect(result_nyc).toEqual({
      date_nyc: '2025-04-10',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 6,
    });
  });

  test('returns nulls for unparseable input', () => {
    const result_nyc = parse_request_nyc('hello world');
    expect(result_nyc).toEqual({
      date_nyc: null,
      start_time_nyc: null,
      PARTY_SIZE_nyc: null,
    });
  });

  test('handles missing time', () => {
    const result_nyc = parse_request_nyc('table for 4 on March 15');
    expect(result_nyc).toEqual({
      date_nyc: '2027-03-15',
      start_time_nyc: null,
      PARTY_SIZE_nyc: 4,
    });
  });

  test('handles missing date', () => {
    const result_nyc = parse_request_nyc('table for 4 at 7pm');
    expect(result_nyc).toEqual({
      date_nyc: null,
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
  });

  test('handles missing party size', () => {
    const result_nyc = parse_request_nyc('March 15 at 7pm');
    expect(result_nyc).toEqual({
      date_nyc: '2027-03-15',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: null,
    });
  });

  test('parses numeric date format MM/DD', () => {
    const result_nyc = parse_request_nyc('table for 3 on 12/25 at 8pm');
    expect(result_nyc).toEqual({
      date_nyc: '2026-12-25',
      start_time_nyc: '20:00',

      PARTY_SIZE_nyc: 3,
    });
  });

  test('parses "party of X" syntax', () => {
    const result_nyc = parse_request_nyc('party of 8 on March 20 at 6pm');
    expect(result_nyc).toEqual({
      date_nyc: '2027-03-20',
      start_time_nyc: '18:00',
      PARTY_SIZE_nyc: 8,
    });
  });

  test('parses AM time', () => {
    const result_nyc = parse_request_nyc('table for 2 on March 15 at 11am');
    expect(result_nyc).toEqual({
      date_nyc: '2027-03-15',
      start_time_nyc: '11:00',
      PARTY_SIZE_nyc: 2,
    });
  });
});
