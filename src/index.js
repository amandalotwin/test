const { handleReservationRequest } = require('./handleReservation');

const examples = [
  "I'd like a table for 4 on March 15th at 7pm",
  'Reservation for 2 people, 2026-12-25, 6:30 PM',
  'Book a table for 6 on 2025-04-10 at 19:00',
  'hello world',
];

async function main() {
  for (const text of examples) {
    console.log(`\nRequest: "${text}"`);
    const result = await handleReservationRequest(text);
    console.log('Result:', JSON.stringify(result, null, 2));
  }
}

main();
