# Verification report — November 10, 2026 (Asia/Kolkata)

All four milestones were implemented and checked in order. Optional Sandbox draft invoicing was added afterward.

## Automated checks

`npm test`: **14 passed, 0 failed**. Isolated SQLite databases and local HTTP servers; PayPal and AI calls are mocked, never sent externally.

| Area | Result |
| --- | --- |
| Seeded ₹800 allowance minus ₹250/₹150/₹100 | PASS: ₹300 left |
| Add/edit, overspending, Fun isolation | PASS |
| CSV import and repeat-import deduplication | PASS |
| Recap persistence and SQLite close/reopen | PASS |
| Seeded ₹1,00,000 allocation | PASS: ₹18,000 salary savings |
| Payday tomorrow and exact next-month end date | PASS |
| Actual salary replacement and bill matching | PASS: counted once |
| Cash equation, new spending and allocation overruns | PASS |
| Backend OAuth and two-page PayPal Search | PASS with mocked responses |
| Repeat PayPal sync | PASS: zero new imports on retry |
| Currency precision and T1900 opening exclusion | PASS |
| Missing credentials and failed-sync timestamp | PASS |
| INR settlement repeated creation and opening rejection | PASS |
| Thirty-day chart and date boundaries across February | PASS |
| Original / delayed-income scenario | PASS: original no shortfall; delayed first shortfall 2026-11-12 |
| Buffer-safe set-aside amount | PASS |
| Past-due unreceived salary | PASS: excluded from projected cash |
| Redaction and valid model response | PASS with mocked response |
| Missing AI, request failure, invalid model output | PASS: deterministic fallback |
| Projection component changes | PASS: new ₹400 spend uses ₹300 estimate and lowers projection by ₹100 |
| Invoice approval and review idempotency | PASS with mocked responses |
| Invoice concurrent/repeated creation | PASS: one remote POST |
| Invoice uncertain outcome | PASS: retry blocked |

`npm run build`: PASS, Vite production build.

`npm run seed`: PASS, existing data preserved.

Dependency audit found a moderate advisory in csv-parse 6, which was upgraded to 7.0.3. The subsequent npm installation audit reported **0 vulnerabilities**. An offline audit after the update also reported 0; offline checks alone are not a fresh advisory lookup.

## Running app and browser checks

Vite and Express were run at http://127.0.0.1:5173 and http://127.0.0.1:3001 during verification, then stopped after testing. Restart with `npm run dev`. Checked in the Codex in-app browser:

- Today renders ₹300 left, ₹500 spent of ₹800.
- Edited coffee from ₹100 to ₹450: ₹50 overspent. Restored to ₹100 and refreshed: ₹300 left. The demo is left with the original three INR expenses.
- Planner renders ₹18,000 salary savings, salary expected tomorrow and a separately labeled ₹50,800.03 cash projection through 2026-12-31, with assumptions and arithmetic components.
- PayPal tab renders the credentials-missing status and never-synced status.
- Loaded labeled local PayPal sample: T1900 opening balance USD 5,000.00 excluded from income/spending/INR totals, plus a USD 120.00 sample receipt. Repeating import displayed 0 loaded / 2 existing. These sample rows remain available in the local demo; they do not affect INR cash.
- Forecast renders 30-day SVG, no original shortfall, delayed first shortfall November 12 at −₹25,200.01.
- Generate insights with no key shows deterministic guidance, redacted category suggestions and an editable subscription review message.
- Optional invoice UI shows its missing-credentials status, completed-work review form and explicit approval requirement. No real invoice was created.
- Responsive narrow preview checked visually. Desktop-specific viewport resizing was not performed.

Screenshots are in `screenshots/`; `today-card.jpg` shows the seed result, and `today.jpg` shows the complete tracker page.

## Requires your private credentials

These are **not verified against real services**:

1. Sandbox OAuth using your application credentials and its Transaction Search reporting permissions.
2. Actual account pagination, T1900 response and synchronization timing from PayPal Sandbox.
3. Sandbox invoice creation with your Sandbox merchant email and account eligibility, including a returned real invoice ID.
4. OpenAI model access and actual model wording using your API key.

Use `.env.example` placeholders, fill only the backend `.env`, and restart. README contains exact commands and the judge walkthrough. All local milestones work with no credentials. The invoice creation button is for the user's explicit approval after review.

## Calendar addition — November 11, 2026

Added the Calendar view with current/next calendar month, recorded wallet cash, daily allowance left, salary and bill markers, selected-day cash and event details, and the seven-day salary-delay scenario. Automated checks cover canonical ₹300 remaining, wallet ₹5,500, payday events, next-month-end forecast reconciliation, pre-opening dates, expense recalculation, delayed shortfall, payday-today and delayed spending horizons.

Final calendar verification: **17 tests passed, 0 failed**; production build passed. Browser checked on port 3002 because an older backend already occupied port 3001. Checked November 11 payday-today allowance, delayed payday November 18, red shortfall dates, and selecting November 12 to display rent plus spending estimates. Screenshot: `screenshots/calendar.jpg`. Restart any existing backend to load the latest server changes.

## Postman and Render preparation — November 12, 2026

- `npm test`: **18 tests passed**, including production fail-closed behavior, Basic-auth access, public health, HTTPS same-origin writes and rejection of unrelated origins.
- `npm run test:postman`: **17 requests and 42 assertions passed**, using the actual Postman/Newman collection runner against a disposable temporary database. The live PayPal/AI folders were explicitly skipped in this fixture run.
- `npm run test:production`: PASS. Actual production entry point served the React build and SVG behind authentication; an expense survived a full process restart on a temporary SQLite database.
- Newman is an optional external development runner via pinned `npx`; it is not an application dependency or part of the deployed service. Its legacy dependency audit issues were the reason it was removed from the app dependency tree after validation.
- Render connected successfully. Blueprint and guide are prepared, but no service/disk was created and no hosted URL exists. A repository URL is still needed before generating a reviewable remote plan; paid resource creation has not been approved.
- Real backend Sandbox OAuth/Search verification imported one record in a 30-day window; repeating the same window imported zero records and recognized one existing record. No invoice or payment was created. The real row remains in ignored local SQLite.
- AI credentials remain missing; no live model response is claimed.
