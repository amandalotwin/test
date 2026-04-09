const { send_confirmation_email_nyc, get_sent_emails_nyc, reset_sent_emails_nyc } = require('../src/mockEmailApi');

beforeEach(() => {
  reset_sent_emails_nyc();
});

describe('send_confirmation_email_nyc', () => {
  test('sends a confirmation email with valid parameters', async () => {
    const result_nyc = await send_confirmation_email_nyc({
      to_nyc: 'guest@example.com',
      confirmation_nyc: 'RES-ABC12',
      date_nyc: '2026-12-25',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
    expect(result_nyc.success_nyc).toBe(true);
    expect(result_nyc.message_id_nyc).toMatch(/^MSG-/);
  });

  test('records sent email in the store', async () => {
    await send_confirmation_email_nyc({
      to_nyc: 'guest@example.com',
      confirmation_nyc: 'RES-ABC12',
      date_nyc: '2026-12-25',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
    const emails_nyc = get_sent_emails_nyc();
    expect(emails_nyc.length).toBe(1);
    expect(emails_nyc[0].to_nyc).toBe('guest@example.com');
    expect(emails_nyc[0].subject_nyc).toContain('RES-ABC12');
    expect(emails_nyc[0].body_nyc).toContain('4');
    expect(emails_nyc[0].body_nyc).toContain('2026-12-25');
    expect(emails_nyc[0].body_nyc).toContain('19:00');
    expect(emails_nyc[0].message_id_nyc).toBeDefined();
    expect(emails_nyc[0].sent_at_nyc).toBeDefined();
  });

  test('fails when email address is missing', async () => {
    const result_nyc = await send_confirmation_email_nyc({
      to_nyc: '',
      confirmation_nyc: 'RES-ABC12',
      date_nyc: '2026-12-25',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_id_nyc).toBeNull();
  });

  test('fails when email address is invalid (no @)', async () => {
    const result_nyc = await send_confirmation_email_nyc({
      to_nyc: 'not-an-email',
      confirmation_nyc: 'RES-ABC12',
      date_nyc: '2026-12-25',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
    expect(result_nyc.success_nyc).toBe(false);
    expect(result_nyc.message_id_nyc).toBeNull();
  });

  test('tracks multiple sent emails', async () => {
    await send_confirmation_email_nyc({
      to_nyc: 'a@example.com',
      confirmation_nyc: 'RES-001',
      date_nyc: '2026-12-25',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 2,
    });
    await send_confirmation_email_nyc({
      to_nyc: 'b@example.com',
      confirmation_nyc: 'RES-002',
      date_nyc: '2026-12-26',
      start_time_nyc: '20:00',
      PARTY_SIZE_nyc: 6,
    });
    const emails_nyc = get_sent_emails_nyc();
    expect(emails_nyc.length).toBe(2);
    expect(emails_nyc[0].to_nyc).toBe('a@example.com');
    expect(emails_nyc[1].to_nyc).toBe('b@example.com');
  });

  test('reset clears all sent emails', async () => {
    await send_confirmation_email_nyc({
      to_nyc: 'guest@example.com',
      confirmation_nyc: 'RES-ABC12',
      date_nyc: '2026-12-25',
      start_time_nyc: '19:00',
      PARTY_SIZE_nyc: 4,
    });
    expect(get_sent_emails_nyc().length).toBe(1);
    reset_sent_emails_nyc();
    expect(get_sent_emails_nyc().length).toBe(0);
  });
});
