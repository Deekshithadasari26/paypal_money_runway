# PayPal AI Hackathon readiness checklist

Assessment: November 11, 2026, Asia/Kolkata. Based on the supplied rules, current official Devpost pages, this workspace and the existing verification report. This is an evidence-based readiness assessment; the organizer decides eligibility.

**Verdict: working local prototype, not yet a complete submission.**

## Deadline

- [ ] Submit on Devpost before **November 12, 2026, 12:00 noon PST**, which converts to **November 13, 2026, 1:30 AM IST**. Aim to finish earlier.
- [ ] Preserve judge access through the judging period ending December 15, 2026, 8:00 AM PST / 9:30 PM IST.

Sources: [Official rules](https://paypalaihackathon.devpost.com/rules), [submission requirements](https://paypalaihackathon.devpost.com/).

## Mandatory project and submission requirements

| Check | Current status | Evidence / work left |
| --- | --- | --- |
| Working application | DONE locally | React + Vite, Express, SQLite. Tracker, planner, PayPal ledger, forecast, insights, calendar and optional invoice review flow. |
| Installable and consistently runnable | DONE locally; judge reproduction pending | README has exact commands and Node 24 requirement. Latest verification: 17 tests passed and production build passed. Recheck a fresh clone before recording. Restart older backends to load current code. |
| PayPal developer platform integration using Sandbox | IMPLEMENTED; app-level live verification pending | Backend OAuth, paginated Transaction Search and optional invoice draft creation are real API code. Mocked tests pass. User reported OAuth/Search success in Postman; that does not verify this app's credentials, permissions and request flow. |
| Meaningful AI integration | IMPLEMENTED; live verification pending | OpenAI Responses API for category suggestions, projection explanations and editable subscription message. Schema validation and redaction exist. Missing key uses rules-based guidance, which must not be presented as a live AI result. |
| PayPal central to the project | NEEDS STRONGER DEMONSTRATION | Budgeting currently works independently of PayPal. Demonstrate an actual Sandbox import, original-currency treatment, a recorded INR settlement counted once, its effect on cash/calendar, and model insights. Branding alone does not establish meaningful integration. |
| Functional demo accessible to judges | PARTIAL | Local setup/run instructions exist. A hosted URL is optional, but judges must be able to run or interact with the app. Define how they can exercise the real PayPal/AI features, not just sample/fallback mode. |
| Public GitHub/GitLab/Bitbucket repository | NOT FOUND | This folder is not currently a Git repository. No public repository URL was provided. Create/publish one after checking for secrets and runtime data. |
| Complete source, assets and instructions in repository | READY LOCALLY; publication pending | Source, lockfile, PayPal SVG, sample CSV, README, tests and example environment file exist. Verify the published repository contains them. |
| Open-source license | DONE locally | MIT LICENSE exists. Confirm GitHub/GitLab/Bitbucket detects it after publishing. PayPal trademark artwork is separately credited; it is not relicensed under MIT. |
| Project text description | PARTIAL | README covers functionality. Devpost pitch, target user, problem, differentiation, AI/tool usage and limitations still need submission-ready text. |
| Public YouTube demonstration under 3 minutes | NOT PROVIDED | Record the real app running, upload publicly and add the URL to Devpost. No video artifact or link is present in the workspace/conversation. |
| English materials | PARTIAL | App and README are English. Ensure submitted description, demo narration/captions and testing instructions are also English. |
| Required Devpost fields and final submission | UNVERIFIED | Registration and Devpost submission state were not inspected. Saving a draft is not final submission. |
| Free, unrestricted judge access through judging | PLAN NEEDED | Document reproducible setup and a suitable test-access path. Keep any hosted demo and required services available until judging ends. Do not put private client secrets or AI keys into the public repo; provide an appropriate protected test-access process where needed. |
| Built or significantly updated during submission period | SUPPORTED BY SESSION; entrant confirmation needed | This project was built/updated in this conversation during November 10–11. Preserve source history and describe work done during the event. Organizer decides sufficiency. |
| Eligibility, ownership and conflicts | USER CONFIRMATION NEEDED | Confirm age of majority, eligible residence, no excluded affiliation/conflict, ownership/authorization and no disqualifying prior support. App code cannot establish personal eligibility. |
| Authorized third-party assets and integrations | REVIEW NEEDED | Check dependency/API terms and permissions for video assets. I added PayPal branding at your request; downloading an official logo and crediting it does not itself establish permitted use. Confirm PayPal name/logo use for this submission and avoid implying official ownership or endorsement. Do not use unlicensed music or copied Instagram footage. |
| Team representative, if applicable | UNVERIFIED / CONDITIONAL | If entering as a team/organization, appoint an eligible authorized representative and list contributors accurately. |

## Product feature checks (our requested build)

These are project features, not all separate hackathon mandates.

- [x] Everyday allowance, seeded ₹300 remainder, add/edit expenses, explicit overspending.
- [x] SQLite persistence, labeled INR CSV import, Fun bucket, saved recaps.
- [x] Salary allocations, salary recording, due-date commitments and confirmed-payment matching.
- [x] Separate salary savings and exact next-calendar-month-end cash projection.
- [x] Backend PayPal OAuth/Search, pagination, deduplication and last-success status.
- [x] Original currency retained; T1900 opening balance excluded from income/spending/INR cash.
- [x] Optional PayPal-to-INR settlement matching, counted once.
- [x] Deterministic 30-day forecast and seven-day income-delay shortfall.
- [x] Calendar with daily allowance left, payday/bill markers and selected-day explanation.
- [x] AI request implementation, redaction, validated output and clearly labeled fallback.
- [x] Editable locally saved subscription message.
- [x] Optional reviewed/approved invoice draft code and retry safeguards, verified with mocks.
- [ ] Live end-to-end PayPal sync from this app using private Sandbox credentials.
- [ ] Live model result from this app using private AI credentials.
- [ ] Real Sandbox draft invoice with returned ID, if included in the video; user must explicitly approve creation. A draft is not a completed payment or agent-to-agent transaction.

## Sponsor resources: optional, not a requirement to use every tool

| Resource | Our use |
| --- | --- |
| AG Grid | Not integrated. Tables use ordinary React/HTML. |
| APIMatic | Not integrated. Backend calls APIs directly. |
| Astropods | Not integrated. |
| Bryntum | Not integrated. Calendar is our React component. |
| Channel3 | Not integrated. |
| Elastic | Not integrated. |
| KERNEL | Not integrated. |
| Postman | User reports testing Sandbox OAuth and Transaction Search. No exported collection is currently included. |
| Render | Not deployed there. |
| Zapier | Not integrated. |
| PayPal AI Toolkit / Agent Toolkit / MCP | Not integrated; project uses direct PayPal REST calls. The general entry rules do not require those specific toolkits. |
| Webinars | Learning resources; attendance is not listed as an entry requirement. |

Sponsor-specific award requirements apply only when targeting those awards. Do not claim a Bryntum award because we have a calendar, or an AG Grid award because we display a table. Check the relevant sponsor resource page before claiming a sponsor-specific integration/award. Adding every sponsor is unnecessary.

## Judging readiness (assessment, not a predicted score)

| Criterion | Assessment | Next improvement |
| --- | --- | --- |
| Technological implementation | Stronger local foundations; real-service evidence incomplete | Show backend-owned OAuth, repeat-sync deduplication, currency separation and a real validated AI response. |
| Design | Coherent PayPal-blue UI and calendar built | Record a clear desktop walkthrough and test the final viewport. |
| Potential impact | Useful scenario, needs a specific audience and evidence | Position for people paid through PayPal who must cover INR living costs; demonstrate the cash gap before bills. Validate this with a real user if possible. |
| Innovation/idea | Budget trackers are common | Emphasize settlement-aware currency separation, exact cash runway and explainable delayed-income calendar. Do not claim uniqueness without evidence. |
| Presentation | Main deliverables missing | Complete the pitch and short end-to-end video. |

The five official criteria are equally weighted. Consumer budgeting is a plausible fit; autonomous transactions are an inspiration example, not a universal requirement. The current system should not be advertised as an autonomous paying agent.

## Finish in this order

1. [ ] Configure private backend Sandbox and AI credentials; restart the current app.
2. [ ] Verify and capture actual Sandbox sync, repeat sync, original currency and INR settlement behavior.
3. [ ] Generate a real model insight; show redacted facts and unchanged authoritative budget math.
4. [ ] If demonstrating invoicing, review then explicitly approve one Sandbox draft and record its returned ID.
5. [ ] Confirm branding/asset permissions and personal/team eligibility.
6. [ ] Publish source to a public repository with detected MIT license, complete README and no secrets or private SQLite data.
7. [ ] Reproduce setup from a clean clone and define judge access for credential-dependent features.
8. [ ] Write the Devpost description and tool-use explanation accurately; label seeded, mocked, live and fallback behavior.
9. [ ] Record and publish a YouTube video under three minutes showing the working build.
10. [ ] Complete all Devpost fields, add repository/video/demo or run instructions, and submit before the deadline.
11. [ ] Keep access working through judging; preserve the submitted version.

## Update — November 12, 2026

- [x] Secret-free Postman collection and environment template added; actual runner verified 17 requests / 42 assertions.
- [x] PayPal Sandbox backend OAuth and Transaction Search verified with private backend credentials; repeat import added zero records.
- [x] Render-compatible production configuration, persistent-disk Blueprint and protected judge access prepared and tested locally.
- [x] Render account connection confirmed.
- [ ] Source repository URL still required; no Render service has been deployed or billed by this task.
- [ ] Review and authorize the concrete Render plan after it can be generated from the repository.
- [ ] Live AI still needs an API key and actual model verification.

Latest automated results: 18 app tests passed, 42 Postman assertions passed, production build and persistence/restart smoke check passed. See `docs/RENDER.md` and `postman/README.md`.
