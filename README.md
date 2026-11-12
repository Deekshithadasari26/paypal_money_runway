# PayPal Money Runway

A working local PayPal AI hackathon demo: React + Vite frontend, Express backend and SQLite storage. One demo profile, INR cash budget, Asia/Kolkata calendar. No credentials are required for the budget, CSV import, forecast, scenario or deterministic insights.

## Install, seed, run, test

Requires **Node.js 24 LTS** (uses built-in `node:sqlite`) and npm. Run in this folder:

```sh
npm ci
cp .env.example .env
npm run seed
npm run dev
```

Open http://127.0.0.1:5173. Vite proxies `/api` to Express at port 3001. The seed is idempotent and preserves existing changes. Database: `data/money-runway.sqlite`, with SQLite WAL sidecars. `.env` and database files are ignored by Git. Never put secrets in `VITE_*` variables.

```sh
npm test
npm run build
# Optional source formatting
npm run format
```

For a single-server production build on this local computer, stop `npm run dev`, then:

```sh
npm run build
npm start
```

Open http://127.0.0.1:3001. Normal local development binds to loopback and has no login unless a demo password is configured. Hosted production uses a password-protected single-profile judge demo, persistent SQLite, and the deployment settings described in `docs/RENDER.md`. This remains a single-profile demo, not a multi-user product.

To create a fresh demo without deleting existing data, stop the server and change `DATABASE_PATH` in `.env` to a new file, e.g. `./data/judges-demo.sqlite`, then run `npm run seed` and `npm run dev`. A fresh profile seeds on the current Asia/Kolkata date. For the exact November 10 scenario, use a new database seeded with:

```sh
DATABASE_PATH=./data/november-demo.sqlite node --input-type=module -e "import {openDb,seed} from './server/db.js'; import {seedPlanner} from './server/planner.js'; const db=openDb(); seed(db,'2026-11-10'); seedPlanner(db,'2026-11-10'); db.close();"
```

Set `.env` to that database path, restart, and choose **2026-11-10** in the demo date control. Demo dates must be on/after the opening date and within 700 days of it. The default planner uses the day after seeding as the monthly payday; for the canonical scenario it is day 11. Actual live time and PayPal sync timestamps always use the real clock, independently of the demo date.

## Judge walkthrough (milestones in order)

1. **Today**: ₹800 allowance; ₹250 lunch, ₹150 office travel and ₹100 coffee; **₹300 left**. Add a ₹350 everyday expense: **₹50 overspent**, visibly labeled. Edit it to ₹200: **₹100 left**. Refresh to confirm persistence. Fun expenses change the separate Fun total. End-of-day recap saves a snapshot in the app, with previous recaps displayed below. Press it again to update that day's snapshot.
2. Import `samples/inr-bank-upi.csv` through **Import sample INR CSV**. Its dates are deliberately fixed at 2026-11-10 and each row is labeled **Sample INR CSV**. Choose that demo date to see them; for another opening date, edit a copy of the CSV first. Reimporting identical rows skips them. CSV columns: `id,date,description,amount,currency,bucket`; amount is positive decimal rupees, currency must be INR, bucket is everyday/fun/bills/subscriptions/sip/debt. Quoted CSV fields are supported; malformed files import no rows. Maximum 1000 rows, 256 KB request. Exported bank files with different columns need mapping to this sample format.
3. **Payday planner** on November 10: “Your salary is expected tomorrow.” Seeded salary **₹1,00,000**, everyday **₹24,000**, rent/EMI/insurance **₹38,000**, subscriptions **₹2,000**, Fun **₹8,000**, SIP **₹10,000**, **Cash savings from this salary ₹18,000**. Plan inputs and commitments are editable. The demo opening cash is **₹6,000 at start of November 10** and cash buffer **₹5,000**.
4. **Record Salary** for a selected expected payday; actual amount/date replaces that expected inflow. Re-recording the same payday updates it. Use **Confirm paid** for a bill: either record a new payment or select an existing unmatched INR expense of the same amount/bucket. Repeated confirmation is idempotent. A reservation alone is never an actual transaction.
5. **PayPal activity**: credentials-missing status is explicit. **Load sample PayPal activity** loads a clearly labeled local fixture: USD 5,000.00 initial balance (T1900) and USD 120.00 sample payment. The initial balance is excluded from income, spending, actual INR cash and projections. The activity ledger preserves original currency and status. An optional existing/new INR settlement match counts only the INR transaction; foreign activity itself never enters the INR budget. One INR settlement can match only one PayPal activity. Repeated settlement creation for the same payment returns the existing match.
6. **Forecast & AI**: 30 daily closing balances, planned versus seven-day income delay, first shortfall and buffer-safe extra capacity. Canonical demo: original plan has no shortfall; salary moved from **November 11 to November 18** produces first shortfall on **November 12**, **−₹25,200.01**. Daily calculations are inspectable. **Generate insights** works without a key, with a clearly labeled deterministic fallback. Suggested categories never modify entries automatically. The subscription message is editable, saved locally, and never sent.
7. Optional invoice: in PayPal activity, review a USD test invoice for completed work, then explicitly check the approval checkbox before **Approve & create Sandbox draft**. This creates a real Sandbox draft only, never sends it. No remote invoice was created during development verification.

## Budget and forecast rules

- All stored amounts are safe integer minor units, INR in paise. Each PayPal row keeps original currency and the corresponding currency exponent (e.g. JPY has zero decimals). CSV decimals are validated and converted at the boundary.
- `Cash savings from this salary` is the selected calendar month's actual salary (or expected salary if unrecorded), minus the larger of reserved or recorded spending for each allocation. Negative results are allowed. This is unallocated salary cash, not a completed savings transfer. Expenses within an existing allocation use that allocation; overruns reduce this figure. Changing actual salary changes it immediately.
- `Projected cash by [date]` uses the **last day of the next calendar month**, inclusive. For November 10 this is **December 31, 2026**. It equals opening INR cash + recorded income − recorded expenses + unmatched planned income − unmatched commitments − estimated everyday/Fun outflows. The UI exposes every component and the assumptions. In the clean canonical seed it is **₹50,800.03**. It is intentionally a different figure from salary savings.
- Recorded transactions before the opening date do not change opening cash. There is no automatic salary receipt. Unmatched salary repeats on the chosen day each month. Due days 29–31 are clamped to month-end. Overdue unpaid commitments remain reserved. Past-due unrecorded salary is excluded from projected cash until it is actually recorded. A bill/salary match replaces its whole planned occurrence, including when its actual date differs.
- Every day's future everyday estimate is the daily allowance minus that day's already recorded everyday expenses, floored at zero. Today includes only the unspent portion. Future Fun is the monthly allocation distributed across calendar days with remainder paise assigned to earliest days. Historical days use recorded cash movements only; missing historical spending is not invented. Changing monthly everyday allocation sets the daily allowance to allocation / 30, rounded to paise. Calendar months with 31 days can therefore use more than ₹24,000 at ₹800/day. Assumptions remain visible.
- Actual future-dated entries count on their date. Salary and bill matching excludes the original expected occurrence. Money reserved for SIP leaves cash when due; cash savings remains cash. No FX rates, PayPal opening balance, foreign receipts, or internal allocation “transfers” inflate INR cash.
- Adding an expense recalculates daily left, actual cash, allocations and forecasts. A small spend within today's remaining forecast allowance replaces part of the estimate and need not lower the end projection; spending beyond estimates does. Matching an already recorded expense removes the duplicate planned reservation.
- Forecast daily close starts with actual cash movements and includes salary dates, bill dates, debt minimums, SIPs, everyday/Fun estimates. Scenario moves only the next **unrecorded** expected salary seven days; later paydays stay unchanged. The end-month projection and 30-day chart use the same engine; the forecast horizon extends if needed to contain all 30 days.
- Extra set-aside capacity is `max(0, min(actual cash now, every daily closing balance through forecast horizon) − buffer)`. It is a one-time capacity for savings **or** debt, not both independently. It uses the original scenario; it is not a promise about intraday payment order. The default buffer leaves ₹0 extra before tomorrow's salary.

## Private PayPal Sandbox setup

Fill backend `.env` with **your own Sandbox** values:

```dotenv
PAYPAL_CLIENT_ID=YOUR_SANDBOX_CLIENT_ID
PAYPAL_CLIENT_SECRET=YOUR_SANDBOX_CLIENT_SECRET
PAYPAL_INVOICER_EMAIL=YOUR_SANDBOX_BUSINESS_EMAIL
```

Restart the backend after changing `.env`. Do not copy your Postman access token: the backend obtains its own OAuth token for each sync, using Basic authentication and `grant_type=client_credentials`. Calls are hard-coded to `https://api-m.sandbox.paypal.com`; no Live API mode is provided. Tokens and credentials never enter SQLite or frontend responses.

`POST /api/paypal/sync` accepts `start` and `end` ISO timestamps. The UI interprets chosen dates in Asia/Kolkata. Choose up to 31 days ending in the past (typically yesterday). Pages start at 1, `page_size=100`, `fields=all`, balance-affecting records only. Every page is fetched before a single atomic import. Records upsert on a unique hash of PayPal transaction ID + event code + currency; repeat sync updates status/amount without duplicates. Pending/non-success records remain visible but cannot be matched as posted settlements. Last-success time updates only after the full import succeeds. Transaction Search may lag recent activity; ensure your application has reporting permissions. Sync older history using successive <=31-day windows. Sync failures preserve prior data and successful timestamp.

Sandbox invoice draft creation additionally needs your Sandbox business email. Review stores an immutable payload and durable request ID. Identical review submissions return the same action. Creation requires `{approved:true}` and atomically claims the action before calling PayPal. A successful retry returns the stored invoice ID. Concurrent attempts cannot issue another creation. An ambiguous timeout/crash blocks automatic retry; inspect your Sandbox invoicing dashboard and use the stored request ID to reconcile before making another invoice. This favors avoiding duplicates over silently retrying an uncertain financial action. Invoice email edits require a new review. No invoice send endpoint exists.

## Optional AI

```dotenv
OPENAI_API_KEY=YOUR_AI_API_KEY
OPENAI_MODEL=gpt-4.1-mini
```

Backend-only OpenAI Responses API, `store:false`, strict JSON schema, 25-second timeout. Only an allowlist of generic spending words survives description redaction; raw merchant/person/account identifiers, emails, phones, transaction IDs and PayPal descriptions are not sent. The UI exposes the exact facts shared. The backend computes cash, projections, deltas since the last generated insight, salary variance and allocation overruns. The model supplies wording, category suggestions, and one subscription review draft; it never computes or changes the budget. Zod validates length, keys, category enums, transaction references and subscription reference. Schema validation cannot establish factual accuracy of prose: all AI suggestions are labeled for review and backend figures remain authoritative. Missing keys, HTTP failure, timeout, refusal, incomplete response or invalid schema use deterministic guidance. Draft edits remain in SQLite.

## Tests and verification

`npm test` uses Node's built-in test runner, isolated SQLite databases, local ephemeral HTTP servers, and injected mocked PayPal/AI responses. It requires permission to open loopback ports in restrictive sandboxes. It does **not** call a live paid model, PayPal Sandbox or create real invoices.

Checks cover:

- ₹300 seed remainder; add/edit recalculation; overspending; Fun separation; CSV deduplication; recap storage; SQLite reopen persistence.
- ₹18,000 seeded salary savings; tomorrow notification; actual salary replacement; confirmed bill matching counted once; exact end-month reconciliation; allocation overrun recalculation.
- Backend OAuth authorization, paginated sync, repeat imports, original currency precision, T1900 exclusion, missing credentials, failed-sync timestamp preservation, repeated settlement protection.
- Exactly 30 forecast days, deterministic outcomes, delayed-income shortfall, buffer preservation, redaction, model outage/invalid-response fallback, valid structured model response.
- Optional invoice explicit approval, stable review IDs, concurrent/repeat creation protection and uncertain-outcome blocking.

See `VERIFICATION.md` for the final run report. Private credentials are required to verify real OAuth/Transaction Search permissions, real Sandbox data and invoicing eligibility, and real model access. Mocked successes do not establish those account-specific capabilities.

## Layout

- `server/db.js`: SQLite schema, demo tracker seed, IST clock.
- `server/app.js`: expenses, CSV, recaps, request validation.
- `server/planner.js`: allocations, recurring slots, matching and exact-date cash projection.
- `server/paypal.js`: backend OAuth, paginated sync, deduplication, settlement matching.
- `server/forecast.js`: scenario, buffer capacity, redaction and validated AI/fallback.
- `server/invoice.js`: reviewed/approved Sandbox invoice draft with durable idempotency state.
- `src/`: responsive React UI. `samples/`: labeled INR bank/UPI CSV.
- `tests/`: isolated integration and calculation checks.

## API references

Implementation follows [PayPal Transaction Search](https://developer.paypal.com/api/transaction-search/v1), [PayPal Invoicing v2](https://developer.paypal.com/api/invoicing/v2/), [PayPal request idempotency](https://developer.paypal.com/api/rest/reference/idempotency/) and [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses).

MIT licensed; see `LICENSE`.

## Money calendar

Open **Calendar** for this month and next month in Asia/Kolkata. Tiles show everyday allowance minus recorded everyday spending (₹300 on the canonical November 10 seed). Fun is separate. Select a date for recorded closing cash on past dates, or projected closing cash for today/future dates, along with salary, recorded activity, bill/SIP reservations and estimated everyday/Fun outflows. Dates before the opening balance are disabled. Reservations and expected salary are explicitly labeled; calendar selection never records or pays anything.

The wallet is actual recorded INR cash. The everyday plan before salary is the remaining daily allowance summed through the day before the next expected salary, including today when salary is due today; it is an allocation, not additional cash. Toggle the seven-day salary delay to update both the effective payday and projected calendar. Red tiles flag everyday overspending or negative projected cash. The first-shortfall panel links to the affected day and explains its inputs. All figures use the existing backend projection and SQLite records; the calendar itself requires no new credentials.

## Sponsor resources: Postman and Render

A secret-free [Postman collection](postman/Money-Runway.postman_collection.json) and [local environment template](postman/Local.postman_environment.json) are included. Default runs are read-only. `npm run test:postman` runs fixture/mutation checks against a temporary isolated database with no private credentials. Optional live folders require explicit opt-in. See [Postman instructions](postman/README.md).

Render deployment is prepared in `render.yaml`: one Node service, persistent SQLite disk, HTTPS-compatible origin validation, a health endpoint and password-protected judge access. **It is not deployed yet.** A source repository and review/approval of Render's paid service/disk plan are still required. See [Render deployment guide](docs/RENDER.md). Production no longer uses the local no-auth/loopback configuration.

Actual backend verification can be repeated with `npm run verify:live`. It imports PayPal Sandbox activity and repeats the same search window, reporting counts/status only. A configured AI key enables one actual insight request; missing AI credentials are reported as unconfigured, never as a successful model test. This script never creates an invoice or makes a payment.

### Gemini alternative

To use Gemini instead of OpenAI, save these values in the backend `.env` (never in React or Git):

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
GEMINI_MODEL=gemini-flash-latest
```

Restart the backend and run `npm run verify:live`. AI is verified only when the result reports `status: verified` and `mode: model`. Free-tier availability and quota depend on your Google project/model. Gemini receives only the same redacted descriptions and backend-computed facts as the OpenAI integration; use demo data with the free tier. Structured output is validated locally, and quota failures or invalid responses fall back to deterministic guidance. Set `AI_PROVIDER=openai` to use the existing OpenAI integration instead.
