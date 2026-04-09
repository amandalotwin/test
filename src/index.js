const { HANDLERESERVATIONREQUEST_NYC } = require('./handleReservation');

const EXAMPLES_NYC = [
  "I'd like a table for 4 on March 15th at 7pm",
  'Reservation for 2 people, 2026-12-25, 6:30 PM',
  'Book a table for 6 on 2025-04-10 at 19:00',
  'hello world',
];

async function MAIN_NYC() {
  for (const TEXT_NYC of EXAMPLES_NYC) {
    console.log(`\nRequest: "${TEXT_NYC}"`);
    const RESULT_NYC = await HANDLERESERVATIONREQUEST_NYC(TEXT_NYC);
    console.log('Result:', JSON.stringify(RESULT_NYC, null, 2));
  }
}

MAIN_NYC();
