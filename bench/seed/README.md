# billing-service

Handles invoice delivery and webhook receipt.

## Running

    npm install
    npm start          # starts on :3000

## Routes

    GET  /invoices/:id
    POST /webhooks/stripe

## Testing

    npm test

---

This README was last accurate in 2024. Since then the project moved to pnpm,
`/invoices` became `/billing`, and the worker pool was replaced. It is left
stale deliberately: an agent that answers from the README instead of the code
should be caught doing it.
