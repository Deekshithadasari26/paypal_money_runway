import Invoice from "./Invoice";
import React, { useState, useEffect } from "react";
import { api, money, minor } from "./lib";
const original = (t) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: t.currency,
    currencyDisplay: "code",
  }).format(
    t.amount /
      10 **
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: t.currency,
        }).resolvedOptions().maximumFractionDigits,
  );
export default function PayPal({ date, run, setNotice }) {
  const [p, setP] = useState(null),
    [busy, setBusy] = useState(false);
  const load = () => api("/paypal").then(setP);
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
  }, []);
  async function act(fn) {
    setBusy(true);
    await run(async () => {
      await fn();
      await load();
    });
    setBusy(false);
  }
  if (!p) return <p>Loading PayPal activity…</p>;
  return (
    <>
      <section className="panel paypal-banner">
        <div>
          <p className="eyebrow">CONNECTED, WITHOUT THE GUESSWORK</p>
          <h3>PayPal Sandbox activity</h3>
          <p className="muted">
            Original currency stays original. Your INR cash stays grounded.
          </p>
        </div>
        <span className="badge">SANDBOX ONLY</span>
      </section>
      <div className="notice">
        {p.status}
        <br />
        <small>
          Last successful sync:{" "}
          {p.lastSync
            ? new Date(p.lastSync.at).toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
              }) + " IST"
            : "Never"}
        </small>
      </div>
      <div className="grid">
        <section className="panel">
          <h3>Activity ledger</h3>
          {p.transactions.length === 0 && (
            <p className="empty">
              No activity yet. Sync your Sandbox or load the clearly labeled
              sample.
            </p>
          )}
          {p.transactions.map((t) => (
            <div className="paypal-entry" key={t.id}>
              <div className="transaction">
                <span className="icon">
                  {t.kind === "opening" ? "◒" : t.kind === "income" ? "↓" : "↑"}
                </span>
                <div>
                  <strong>{t.description}</strong>
                  <small>
                    {t.date} · {t.source} · {t.event_code} · {t.status}
                  </small>
                </div>
                <b>{original(t)}</b>
              </div>
              {t.kind === "opening" ? (
                <p className="muted">
                  Opening balance · excluded from income, spending and all INR
                  totals.
                </p>
              ) : (
                <>
                  <p className="muted">
                    {t.kind} ·{" "}
                    {t.matched_id
                      ? "Matched to INR settlement #" + t.matched_id
                      : "Excluded from INR budget until an INR settlement is recorded."}
                  </p>
                  {!t.matched_id && t.status === "posted" && (
                    <details>
                      <summary>Match or record INR settlement</summary>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.target);
                          act(() =>
                            api("/paypal/match", {
                              paypal_id: t.id,
                              settlement_id: Number(f.get("settlement")),
                            }),
                          );
                        }}
                      >
                        <label>
                          Existing INR settlement
                          <select name="settlement" required>
                            <option value="">Choose a transaction</option>
                            {p.settlements
                              .filter(
                                (s) =>
                                  s.kind === t.kind &&
                                  !p.transactions.some(
                                    (a) => a.matched_id === s.id,
                                  ),
                              )
                              .map((s) => (
                                <option value={s.id} key={s.id}>
                                  {s.date} · {s.description} · {money(s.amount)}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button className="secondary" disabled={busy}>
                          Match existing
                        </button>
                      </form>
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          const f = new FormData(e.target);
                          act(() =>
                            api("/paypal/settlement", {
                              paypal_id: t.id,
                              date: f.get("date"),
                              amount: minor(f.get("amount")),
                              bucket: f.get("bucket"),
                            }),
                          );
                        }}
                      >
                        <p className="muted">
                          Or record the actual INR bank credit/debit. Enter the
                          net settlement; no automatic FX conversion.
                        </p>
                        <label>
                          INR amount
                          <input
                            name="amount"
                            type="number"
                            step="0.01"
                            min="0.01"
                            required
                          />
                        </label>
                        <label>
                          Settlement date
                          <input
                            name="date"
                            type="date"
                            defaultValue={date}
                            required
                          />
                        </label>
                        <label>
                          Expense bucket (income unaffected)
                          <select name="bucket">
                            <option value="everyday">Everyday</option>
                            <option value="fun">Fun</option>
                            <option value="bills">Bills</option>
                            <option value="subscriptions">Subscriptions</option>
                            <option value="sip">SIP</option>
                            <option value="debt">Debt</option>
                          </select>
                        </label>
                        <button className="secondary" disabled={busy}>
                          Record & match settlement
                        </button>
                      </form>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
        </section>
        <div>
          <section className="panel">
            <h3>Sync from PayPal</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                act(async () => {
                  const r = await api("/paypal/sync", {
                    start: f.get("start") + "T00:00:00+05:30",
                    end: f.get("end") + "T23:59:59+05:30",
                  });
                  setNotice(
                    `${r.imported} imported · ${r.duplicates} existing · ${r.pages} pages`,
                  );
                });
              }}
            >
              <p className="muted">
                Up to 31 days per request. Dates are in Asia/Kolkata; choose a
                completed day as the end date. New activity may take up to 3
                hours to appear.
              </p>
              <label>
                Start date
                <input
                  name="start"
                  type="date"
                  required
                  defaultValue={new Date(Date.now() - 15 * 86400000)
                    .toISOString()
                    .slice(0, 10)}
                />
              </label>
              <label>
                End date
                <input
                  name="end"
                  type="date"
                  required
                  defaultValue={new Date(Date.now() - 86400000)
                    .toISOString()
                    .slice(0, 10)}
                />
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "Working…" : "Sync PayPal"}
              </button>
            </form>
          </section>
          <section className="panel">
            <h3>A safe demo, ready to go</h3>
            <p className="muted">
              Load a local sample based on the Postman initial-balance response:
              T1900, “Initial balance,” USD 5,000.00. Sample activity is labeled
              separately and never counted as INR.
            </p>
            <button
              className="secondary"
              disabled={busy}
              onClick={() =>
                act(async () => {
                  const r = await api("/paypal/sample", {});
                  setNotice(
                    `${r.imported} sample records loaded · ${r.duplicates} existing`,
                  );
                })
              }
            >
              Load sample PayPal activity
            </button>
          </section>
        </div>
      </div>
      <Invoice run={run} setNotice={setNotice} />
    </>
  );
}
