# Money Runway submission

## Description
Money Runway helps people see what they can spend today without losing sight of upcoming bills. It combines an INR daily tracker, salary allocation, a cash-flow calendar, and a deterministic forecast with PayPal Sandbox activity and Gemini explanations. Amounts use integer minor units; foreign currencies remain separate. PayPal opening balances are not treated as income, and repeated syncs do not duplicate activity. AI receives redacted descriptions and backend-computed facts; all budget math works independently of AI.

Built with React, Vite, Express, SQLite, PayPal OAuth and Transaction Search, Gemini, and a Postman verification collection. MIT licensed. Render deployment configuration is prepared; hosting is not yet verified.

## Final hour
- Minutes 0–10: Refresh the app, select **View seeded demo**, verify ₹300 left and ₹18,000 salary savings. Generate a real AI insight. Keep API keys and environment files off screen.
- Minutes 10–30: Record a demo under 3 minutes using the sequence below.
- Minutes 30–45: Upload the video as **public** on YouTube. Complete Devpost description, technology list, public GitHub repository link and video link.
- Minutes 45–55: Verify the repository README setup commands and MIT license. Clearly state that judges run locally and supply their own sandbox/AI credentials; the seeded app works without credentials.
- Minutes 55–60: Submit the entry and confirm Devpost shows it as submitted. Do not leave it as a draft.

The supplied hackathon rules permit complete repository setup instructions instead of a hosted demo. They require a public open-source repository and a publicly visible YouTube demonstration shorter than 3 minutes. Verify the current submission form's requirements before submitting.

## Video script (2 minutes 45 seconds)
- 0:00–0:20: “Money Runway helps people know what they can spend today and whether their cash will last until the next payment.”
- 0:20–0:45: Daily Money: choose the seeded demo date. Show ₹800 allowance, ₹500 expenses and ₹300 left. Add a ₹50 everyday expense and show ₹250 left; edit the same expense to demonstrate persistence. Restore it if needed before another recording.
- 0:45–1:10: Plan & Insights → Payday planner: show ₹18,000 salary savings and the separately labeled cash projection with assumptions. Show salary expected tomorrow on the seeded date.
- 1:10–1:40: Daily Money → PayPal activity: sync Sandbox, explain the USD opening balance is separate from INR income/spending. Sync again to show zero new duplicates. This demo uses Transaction Search, not a real-money payment.
- 1:40–2:05: Plan & Insights → Forecast & AI: compare the original plan with income delayed seven days. Show the first shortfall. Open Calendar to show dated cash events.
- 2:05–2:35: Generate real Gemini insights, show its validated model status, categories and editable subscription review message. Explain that calculations are deterministic and AI does not move money.
- 2:35–2:45: “Built with React, Express, SQLite, PayPal Sandbox and Gemini. The public repository contains setup instructions and tests.”

Current observed unmodified demo: November 10, 2026; ₹300 left; ₹18,000 salary savings; delayed-income first shortfall November 12 at −₹25,300.01. These values recalculate if data changes.

## Verified and pending
- 19 automated tests and production build pass.
- Browser verified two main navigation choices, ₹300 balance, ₹18,000 savings and delayed-income shortfall.
- User-provided live verification confirms PayPal repeat imports 0 and Gemini mode `model`.
- Hosting and optional Sandbox invoice creation are not verified.
- Video upload and final Devpost submission must still be completed.
