# Reservation System

A simple Node.js reservation system that parses natural language reservation requests and manages bookings using an in-memory mock API.

## What it does

- Parses natural language strings like "I'd like a table for 4 on March 15th at 7pm" to extract date, time, and party size
- Checks availability against a simulated booking database with capacity limits
- Creates reservations and returns confirmation IDs

## Install

```bash
npm install
```

## Run

```bash
node src/index.js
```

## Test

```bash
npm test
```
