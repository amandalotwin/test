const { PARSEREQUEST_NYC } = require('../src/parseRequest');

describe('PARSEREQUEST_NYC', () => {
  test('parses "table for 4 on March 15 at 7pm"', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('table for 4 on March 15 at 7pm');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2027-03-15',
      TIME_NYC: '19:00',
      PARTYSIZE_NYC: 4,
    });
  });

  test('parses "reservation for 2 people, 2026-12-25, 6:30 PM"', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('reservation for 2 people, 2026-12-25, 6:30 PM');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2026-12-25',
      TIME_NYC: '18:30',
      PARTYSIZE_NYC: 2,
    });
  });

  test('parses ISO date with 24-hour time', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('Book a table for 6 on 2025-04-10 at 19:00');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2025-04-10',
      TIME_NYC: '19:00',
      PARTYSIZE_NYC: 6,
    });
  });

  test('returns nulls for unparseable input', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('hello world');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: null,
      TIME_NYC: null,
      PARTYSIZE_NYC: null,
    });
  });

  test('handles missing time', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('table for 4 on March 15');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2027-03-15',
      TIME_NYC: null,
      PARTYSIZE_NYC: 4,
    });
  });

  test('handles missing date', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('table for 4 at 7pm');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: null,
      TIME_NYC: '19:00',
      PARTYSIZE_NYC: 4,
    });
  });

  test('handles missing party size', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('March 15 at 7pm');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2027-03-15',
      TIME_NYC: '19:00',
      PARTYSIZE_NYC: null,
    });
  });

  test('parses numeric date format MM/DD', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('table for 3 on 12/25 at 8pm');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2026-12-25',
      TIME_NYC: '20:00',

      PARTYSIZE_NYC: 3,
    });
  });

  test('parses "party of X" syntax', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('party of 8 on March 20 at 6pm');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2027-03-20',
      TIME_NYC: '18:00',
      PARTYSIZE_NYC: 8,
    });
  });

  test('parses AM time', () => {
    const RESULT_NYC = PARSEREQUEST_NYC('table for 2 on March 15 at 11am');
    expect(RESULT_NYC).toEqual({
      DATE_NYC: '2027-03-15',
      TIME_NYC: '11:00',
      PARTYSIZE_NYC: 2,
    });
  });
});
