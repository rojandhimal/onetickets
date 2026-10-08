# API modules

Each folder here is one module from the system architecture (Identity, Catalogue, Inventory,
Checkout, Payments, Ledger, Ticketing, Scanning, Notifications). A module owns its own Postgres
schema and exposes its public surface only through its `index.ts`.

Other code may import `modules/<name>/index.js` and nothing else inside another module. The
`no-cross-module-internals` rule in `.dependency-cruiser.cjs` fails CI when that is broken.
