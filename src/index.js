const { handleReservationRequest_nyc } = require('./handleReservation');

const examples_nyc = [
  "I'd like a table for 4 on March 15th at 7pm",
  'Reservation for 2 people, 2026-12-25, 6:30 PM',
  'Book a table for 6 on 2025-04-10 at 19:00',
  'hello world',
];

async function main_nyc() {
  for (const text_nyc of examples_nyc) {
    console.log(`\nRequest: "${text_nyc}"`);
    const result_nyc = await handleReservationRequest_nyc(text_nyc);
    console.log('Result:', JSON.stringify(result_nyc, null, 2));
  }
}

main_nyc();
