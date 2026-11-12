import React, { useState, useEffect } from "react";
import { api, minor } from "./lib";
export default function Invoice({ run, setNotice }) {
  const [review, setReview] = useState(null),
    [approval, setApproval] = useState(false),
    [busy, setBusy] = useState(false),
    [status, setStatus] = useState(null);
  const load = () => api("/invoice/status").then(setStatus);
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
  return (
    <section className="panel">
      <p className="eyebrow">OPTIONAL PAYPAL ACTION</p>
      <h3>A draft for work already done</h3>
      <p className="muted">
        Creates a real draft in PayPal Sandbox. It does not send an invoice or
        request a payment. Review the recipient and amount before approving.
      </p>
      {status && !status.configured && (
        <p className="notice">
          Sandbox credentials and a Sandbox business email are required for
          creation. You can review the test invoice without them.
        </p>
      )}
      <div className="grid">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.target);
            act(async () => {
              setReview(
                await api("/invoice/review", {
                  customer: f.get("customer"),
                  description: f.get("description"),
                  amount: minor(f.get("amount")),
                  completed: true,
                }),
              );
              setApproval(false);
            });
          }}
        >
          <label>
            Sandbox recipient email
            <input
              name="customer"
              type="email"
              required
              defaultValue="sandbox-customer@example.com"
            />
          </label>
          <label>
            Completed work
            <input
              name="description"
              required
              minLength={5}
              maxLength={200}
              defaultValue="Completed design work — Sandbox demo"
            />
          </label>
          <label>
            Test amount · USD
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue="120.00"
            />
          </label>
          <label className="check">
            <input type="checkbox" required /> I confirm this is completed work
            for a Sandbox test.
          </label>
          <button className="secondary" disabled={busy}>
            Review test invoice
          </button>
        </form>
        <div>
          {review ? (
            <>
              <h3>Review before creation</h3>
              <p className="muted">PayPal Sandbox · USD · draft only</p>
              <pre>{JSON.stringify(review.invoice, null, 2)}</pre>
              {review.invoice_id ? (
                <div className="notice">Invoice ID: {review.invoice_id}</div>
              ) : (
                <>
                  <label className="check">
                    <input
                      type="checkbox"
                      checked={approval}
                      onChange={(e) => setApproval(e.target.checked)}
                    />{" "}
                    I approve creation of this real Sandbox invoice draft.
                  </label>
                  <button
                    className="primary"
                    disabled={!approval || busy || review.state !== "reviewed"}
                    onClick={() =>
                      act(async () => {
                        const r = await api(
                          "/invoice/" + review.id + "/approve",
                          { approved: true },
                        );
                        setReview({
                          ...review,
                          state: "created",
                          invoice_id: r.invoice_id,
                        });
                        setNotice("Sandbox draft created: " + r.invoice_id);
                      })
                    }
                  >
                    {busy ? "Working…" : "Approve & create Sandbox draft"}
                  </button>
                  {review.state !== "reviewed" && (
                    <p className="muted">
                      State: {review.state}. Check Sandbox to reconcile any
                      uncertain outcome.
                    </p>
                  )}
                </>
              )}
            </>
          ) : (
            <p className="empty">Your invoice preview will appear here.</p>
          )}
        </div>
      </div>
      {status?.actions.length > 0 && (
        <details>
          <summary>Previous draft requests</summary>
          {status.actions.map((a) => (
            <p className="muted" key={a.id}>
              {a.created_at} · {a.state} ·{" "}
              {a.invoice_id || "No confirmed invoice ID"}
            </p>
          ))}
        </details>
      )}
    </section>
  );
}
