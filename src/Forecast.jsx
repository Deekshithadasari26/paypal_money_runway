import React, { useEffect, useState } from "react";
import { api, money } from "./lib";
export default function Forecast({ run, setNotice }) {
  const [f, setF] = useState(null),
    [insight, setInsight] = useState(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api("/forecast")
      .then(setF)
      .catch((e) => setNotice(e.message));
  }, []);
  if (!f) return <p>Computing your runway…</p>;
  return (
    <>
      <div className="stats">
        <article>
          <p>ACTUAL INR CASH TODAY</p>
          <h2>{money(f.cash)}</h2>
          <small>Opening balance + recorded cash movements</small>
        </article>
        <article>
          <p>EXTRA YOU COULD SET ASIDE</p>
          <h2>{money(f.extra)}</h2>
          <small>
            For cash savings or debt · preserving {money(f.buffer)} buffer
          </small>
        </article>
      </div>
      <section className="panel">
        <div className="chart-heading">
          <h3>
            Your next 30 days <small>Daily closing INR cash</small>
          </h3>
          <div className="legend">
            <span>● Original plan</span>
            <span>● Income delayed 7 days</span>
          </div>
        </div>
        <Chart f={f} />
        <div className="scenario-cards">
          <div>
            <span className="badge">ORIGINAL PLAN</span>
            <h3>
              {f.shortfall
                ? "First shortfall: " + f.shortfall.date
                : "No projected shortfall"}
            </h3>
            <small>
              Lowest cash through {f.end}: {money(f.baseMinimum)}
            </small>
          </div>
          <div className={f.delayedShortfall ? "risk" : ""}>
            <span className="badge">7-DAY INCOME DELAY</span>
            <h3>
              {f.delayedShortfall
                ? "First shortfall: " + f.delayedShortfall.date
                : "No projected shortfall"}
            </h3>
            <small>
              {f.delayedShortfall
                ? money(f.delayedShortfall.balance) + " on that day"
                : "Buffer stays above zero"}
            </small>
            <p className="muted">
              {f.expectedIncome
                ? `${money(f.expectedIncome.amount)} expected ${f.expectedIncome.original} → ${f.expectedIncome.delayed}`
                : "No unmatched expected income to delay."}
            </p>
          </div>
        </div>
        <p className="muted">{f.coverage}</p>
        <details>
          <summary>Inspect daily calculations</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Plan inflow</th>
                  <th>Plan outflow</th>
                  <th>Plan cash</th>
                  <th>Delayed cash</th>
                </tr>
              </thead>
              <tbody>
                {f.base.map((p, i) => (
                  <tr key={p.date}>
                    <td>{p.date}</td>
                    <td>{money(p.inflow)}</td>
                    <td>{money(p.outflow)}</td>
                    <td>{money(p.balance)}</td>
                    <td>{money(f.delayed[i]?.balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <section className="panel">
        <div className="insight-header">
          <div>
            <p className="eyebrow">A LITTLE PERSPECTIVE</p>
            <h3>Understand your runway</h3>
          </div>
          <button
            className="primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              await run(async () => {
                const d = await api("/insights", {});
                setInsight(d);
                setMessage(d.draft || d.result.subscription?.message || "");
              });
              setBusy(false);
            }}
          >
            {busy ? "Preparing insights…" : "Generate insights"}
          </button>
        </div>
        <p className="muted">
          Optional AI receives generic redacted descriptions and backend facts.
          Account details, raw memos and PayPal records stay out. Your budget
          works without a model.
        </p>
        {insight && (
          <>
            <div className="notice">{insight.status}</div>
            <p className="explanation">{insight.result.explanation}</p>
            <div className="grid">
              <div>
                <h3>Suggested categories</h3>
                {insight.result.categories.map((c) => (
                  <div className="suggestion" key={c.ref}>
                    <b>
                      {
                        insight.facts.transactions.find((t) => t.ref === c.ref)
                          ?.description
                      }
                    </b>
                    <span className="badge">{c.category}</span>
                    <p className="muted">{c.reason}</p>
                  </div>
                ))}
                <p className="muted">
                  Suggestions do not change transactions. Use Edit on Today to
                  review a category.
                </p>
              </div>
              <div>
                {insight.result.subscription && (
                  <>
                    <h3>One subscription worth reviewing</h3>
                    <p className="muted">
                      Largest recurring subscription:{" "}
                      {money(insight.facts.subscription.amount)} / month. This
                      draft stays in the app.
                    </p>
                    <label>
                      Editable message
                      <textarea
                        rows="9"
                        value={message}
                        maxLength={1600}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                    <button
                      className="secondary"
                      onClick={() =>
                        run(async () => {
                          await api("/subscription-draft", { message }, "PUT");
                          setNotice("Draft saved locally.");
                        })
                      }
                    >
                      Save editable draft
                    </button>
                  </>
                )}
                <details>
                  <summary>See the facts shared with AI</summary>
                  <pre>{JSON.stringify(insight.facts, null, 2)}</pre>
                </details>
              </div>
            </div>
          </>
        )}
      </section>
    </>
  );
}
function Chart({ f }) {
  const all = [...f.base, ...f.delayed].map((p) => p.balance),
    min = Math.min(0, ...all),
    max = Math.max(1, ...all),
    pad = (max - min) * 0.08,
    lo = min - pad,
    hi = max + pad;
  const x = (i) => 58 + (i / 29) * 820,
    y = (n) => 220 - ((n - lo) / (hi - lo)) * 190;
  const path = (points) =>
    points.map((p, i) => (i ? "L" : "M") + x(i) + "," + y(p.balance)).join(" ");
  return (
    <svg
      className="forecast-chart"
      viewBox="0 0 920 270"
      role="img"
      aria-label="Thirty-day INR cash forecast comparing original plan with income delayed seven days"
    >
      <title>
        Daily closing cash. Inspect daily calculations for all values.
      </title>
      {[0, 0.25, 0.5, 0.75, 1].map((fr) => {
        const value = min + (max - min) * fr;
        return (
          <g key={fr}>
            <line
              x1="58"
              x2="880"
              y1={y(value)}
              y2={y(value)}
              stroke="#e2eaf4"
            />
            <text
              x="48"
              y={y(value) + 3}
              textAnchor="end"
              fill="#526b89"
              fontSize="10"
            >
              {(value / 100000).toFixed(0)}k
            </text>
          </g>
        );
      })}
      <line x1="58" x2="880" y1={y(0)} y2={y(0)} stroke="#b4c8df" />
      <path d={path(f.base)} fill="none" stroke="#0070ba" strokeWidth="3" />
      <path
        d={path(f.delayed)}
        fill="none"
        stroke="#ce9266"
        strokeWidth="2.5"
        strokeDasharray="7 5"
      />
      {[0, 7, 14, 21, 29].map((i) => (
        <text
          key={i}
          x={x(i)}
          y="252"
          textAnchor="middle"
          fill="#526b89"
          fontSize="11"
        >
          {f.base[i]?.date.slice(5)}
        </text>
      ))}
      <text x="17" y="15" fill="#526b89" fontSize="10">
        ₹
      </text>
    </svg>
  );
}
