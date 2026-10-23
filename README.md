# Owner facility edit evidence - issue #9

Source: 84d21c3ea2426b744f98fd51cf05d09d846188da
Base: 7d612bc00ba0fbda8efab3ba0c02ddf0ab73ee69
Date: 23/10/2026. Browser: Codex in-app browser.
Requested viewports:1366x900 and390x844; scrollbars may reduce content width15px.

Four images show the real owner form and an actual invalid-phone response.
The fifth shows the owner dashboard after saving all three fields with Enter.
All visible records are disposable fixtures served by the actual app, models,
session and controllers against a separate LOCAL MongoDB8.0.34 replica set.
No .env or Atlas data was read or modified for this work.

npm run check passed17 EJS templates and ESLint. npm test passed42/42,
including12 owner-facility HTTP subtests covering authorization, ownership,
CSRF, mass assignment, validation, escaping, revocation, reassignment and
continued guest bookings after phone changes. QA DB was removed after checks.

Application source: feat/owner-facility-edit. This branch contains evidence only.
