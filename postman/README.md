# Money Runway Postman checks

Import `Money-Runway.postman_collection.json` and `Local.postman_environment.json` into Postman. Select the imported environment and set `baseUrl` to your running backend (`http://127.0.0.1:3001`, or a hosted HTTPS URL). No API client secret, OAuth token or AI key belongs in this collection: requests go through the backend, which owns its environment credentials.

For a protected hosted demo, enter `demoUsername=judge` and the judge password into Postman's local environment value. Do not export/share that populated environment. Only the empty template is committed.

## Normal run: read-only

Run the collection with default flags. Seven requests check health, safe integration status, integer daily money, the exact projection equation, thirty-day forecast, calendar arithmetic and recap retrieval. Optional folders are skipped. These checks do not assume the user's database still contains pristine seed data.

## Reproducible seed and mutation tests

```sh
npm ci
npm run test:postman
```

This starts an ephemeral local server with a temporary SQLite database seeded on November 10, 2026, enables fixture assertions and sample mutations, then deletes the temporary database. It does not read `.env` or contact PayPal/OpenAI. It uses the pinned Newman 6.2.3 runner via `npx`; the optional testing tool stays outside the app's package dependencies and Render build. First use may require network access. Run only this repository's collection with the optional runner.

Expected result: **17 requests, 42 assertions, zero failures**. Live folders are skipped.

The fixture tests verify ₹300 left, ₹18,000 salary savings, a delayed-income shortfall, expense add/edit/overspending, sample CSV deduplication, sample PayPal deduplication, T1900 opening treatment and saved recap generation.

To enable mutations manually in Postman, use a disposable demo database, set `runMutations=true` and run the complete collection in order (read-only checks capture baseline values needed by later requests). They create/edit sample expenses and import sample records; do not enable this on your real profile or a shared judge demo. `expectSeed=true` is only for a fresh canonical November 10 demo, and those seed assertions run before mutations.

## Actual Sandbox verification

1. Configure backend PayPal Sandbox credentials and restart the backend.
2. Set `runLivePayPal=true` in the local Postman environment.
3. Leave `syncStart`/`syncEnd` empty for a 30-day window ending one minute ago, or enter ISO timestamps matching a known populated Postman search range (at most 31 days).
4. Run the collection. The live folder calls the backend sync route twice using exactly the same window, checks zero new imports on repeat, confirms the successful timestamp and distinct external keys.

A successful empty search verifies OAuth/Search connectivity but does not demonstrate populated imports. PayPal can make delayed records visible between two searches; if the repeat imports additional records, inspect their IDs to distinguish new arrivals from a deduplication failure. No invoice creation/payment request exists in the collection.

## Actual AI verification

Configure `OPENAI_API_KEY` on the backend, restart, then set `runLiveAI=true`. This intentionally calls the configured model and can incur API usage. The test requires `mode: "model"`; missing credentials, HTTP failure, refusal, or invalid-output fallback causes this check to fail instead of presenting deterministic guidance as an AI success.

## Regenerate files

```sh
npm run postman:generate
```

This regenerates only the secret-free collection and template from `scripts/generate-postman.mjs`. Never add backend secrets or populated environment exports to source control.

Documentation: [Postman collection workflows](https://learning.postman.com/docs/collections/running-collections/building-workflows/).
