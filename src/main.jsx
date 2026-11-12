import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./style.css";
import { api, money } from "./lib";
import Planner from "./Planner";
import PayPal from "./PayPal";
import Forecast from "./Forecast";
import Recaps from "./Recaps";
import Calendar from "./Calendar";
function App() {
  const [page, setPage] = useState("Today"),
    [p, setP] = useState(null),
    [d, setD] = useState(null),
    [notice, setNotice] = useState(""),
    [editing, setEditing] = useState(null),
    [temporary, setTemporary] = useState(false);
  const load = () =>
    Promise.all([api("/today").then(setD), api("/plan").then(setP)]);
  useEffect(() => {
    load().catch((e) => setNotice(e.message));
    api("/hosting")
      .then((v) => setTemporary(v.temporary))
      .catch(() => {});
  }, []);
  async function run(fn) {
    try {
      await fn();
      await load();
    } catch (e) {
      setNotice(e.message);
    }
  }
  if (!d || !p) return <p>Loading your runway…</p>;
  return (
    <div className="shell">
      <aside>
        <a className="brand" href="/">
          <img
            className="brand-mark"
            src="/paypal-mark.svg"
            alt="PayPal"
            width="32"
            height="40"
          />
          <span>
            <strong className="brand-paypal">PayPal</strong>
            Money Runway<b>MAKE ROOM FOR TOMORROW</b>
          </span>
        </a>
        <nav aria-label="Main navigation">
          <button
            className={
              ["Today", "PayPal activity"].includes(page) ? "active" : ""
            }
            onClick={() => setPage("Today")}
          >
            ◷ Daily Money
          </button>
          <button
            className={
              ["Payday planner", "Forecast & AI", "Calendar"].includes(page)
                ? "active"
                : ""
            }
            onClick={() => setPage("Payday planner")}
          >
            ↗ Plan & Insights
          </button>
        </nav>
        <div className="sidebar-bottom">
          ● Demo profile
          <br />
          <small>INR · Asia/Kolkata</small>
        </div>
      </aside>
      <main>
        {temporary && (
          <div className="notice" role="note">
            Temporary hosted demo · changes are saved during this running
            session, but reset when the free service sleeps, restarts or
            redeploys. Please use demo data only. The local version supports
            persistent SQLite storage.
          </div>
        )}
        <header>
          <span>YOUR MONEY, WITH A LITTLE MORE CLARITY</span>
          <span className="badge">DEMO WORKSPACE</span>
        </header>
        <div className="heading">
          <div>
            <p className="eyebrow">THE EVERYDAY PICTURE</p>
            <h1>
              {page === "Today"
                ? "A little room to breathe."
                : page === "Payday planner"
                  ? "Give every rupee a purpose."
                  : page === "PayPal activity"
                    ? "One ledger. A clearer picture."
                    : "A clearer path to tomorrow."}
            </h1>
            <p>Spend on today. Keep tomorrow in sight.</p>
          </div>
          <label className="demo-date">
            Demo date · Asia/Kolkata
            <input
              aria-label="Demo date"
              type="date"
              value={d.date}
              onChange={(e) =>
                run(() => api("/demo-date", { date: e.target.value }, "PUT"))
              }
            />
          </label>
        </div>
        <div className="workspace-tools">
          <div className="view-tabs" role="group" aria-label="Workspace views">
            {(["Today", "PayPal activity"].includes(page)
              ? ["Today", "PayPal activity"]
              : ["Payday planner", "Forecast & AI", "Calendar"]
            ).map((name) => (
              <button
                key={name}
                className={page === name ? "active" : "secondary"}
                aria-pressed={page === name}
                onClick={() => setPage(name)}
              >
                {name}
              </button>
            ))}
          </div>
          <button
            className="secondary"
            onClick={() =>
              run(() => api("/demo-date", { date: p.plan.baseDate }, "PUT"))
            }
          >
            View seeded demo · {p.plan.baseDate}
          </button>
        </div>
        {notice && (
          <div role="status" className="notice" onClick={() => setNotice("")}>
            {notice} <small>× dismiss</small>
          </div>
        )}
        {page === "Calendar" ? (
          <Calendar key={d.date} date={d.date} setNotice={setNotice} />
        ) : page === "Forecast & AI" ? (
          <Forecast key={d.date} run={run} setNotice={setNotice} />
        ) : page === "PayPal activity" ? (
          <PayPal date={d.date} run={run} setNotice={setNotice} />
        ) : page === "Payday planner" ? (
          <Planner key={d.date} p={p} run={run} setNotice={setNotice} />
        ) : (
          <>
            <section className="hero">
              <div>
                <p>TODAY’S EVERYDAY ALLOWANCE</p>
                <h2>
                  {money(Math.abs(d.left))}{" "}
                  <small>{d.left < 0 ? "overspent" : "left for today"}</small>
                </h2>
                <p>
                  {money(d.spent)} spent of your {money(d.allowance)} allowance
                </p>
                <progress max={d.allowance} value={d.spent} />
              </div>
              <div className="hero-art">
                ↗<span>One day at a time.</span>
              </div>
            </section>
            <div className="grid">
              <section className="panel">
                <h3>
                  Today’s activity{" "}
                  <small>{d.transactions.length} transactions</small>
                </h3>
                {d.transactions.length === 0 && (
                  <p className="muted">
                    No expenses recorded for {d.date}. Choose the seeded demo
                    date above to view the original three expenses, or add an
                    expense for this day.
                  </p>
                )}
                {d.transactions.map((t) => (
                  <div className="transaction" key={t.id}>
                    <span className="icon">
                      {t.bucket === "fun" ? "✧" : "↗"}
                    </span>
                    <div>
                      <strong>{t.description}</strong>
                      <small>
                        {t.bucket} · {t.source}
                      </small>
                    </div>
                    <b>
                      {t.kind === "income" ? "+" : ""}
                      {money(t.amount)}
                    </b>
                    {t.kind === "expense" && (
                      <button className="text" onClick={() => setEditing(t)}>
                        Edit
                      </button>
                    )}
                  </div>
                ))}
                <div className="row">
                  <label className="button secondary">
                    Import sample INR CSV
                    <input
                      type="file"
                      accept=".csv"
                      hidden
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (file)
                          run(async () => {
                            const r = await api("/import-csv", {
                              csv: await file.text(),
                            });
                            setNotice(
                              `${r.imported} imported · ${r.duplicates} duplicates skipped`,
                            );
                          });
                      }}
                    />
                  </label>
                  <button
                    className="secondary"
                    onClick={() =>
                      run(async () =>
                        setNotice((await api("/recap", { date: d.date })).body),
                      )
                    }
                  >
                    End-of-day recap
                  </button>
                </div>
              </section>
              <section className="panel">
                <h3>{editing ? "Edit expense" : "Add a little spend"}</h3>
                <Expense
                  key={editing?.id || d.date}
                  date={d.date}
                  editing={editing}
                  onSave={(v) =>
                    run(async () => {
                      await api(
                        "/expenses" + (editing ? "/" + editing.id : ""),
                        v,
                        editing ? "PUT" : "POST",
                      );
                      setEditing(null);
                      setNotice("Expense saved");
                    })
                  }
                />
                <p className="muted">
                  Fun has its own space. Today: {money(d.fun)}
                </p>
              </section>
            </div>
            <Recaps date={d.date} revision={notice} />
          </>
        )}
        <footer>
          Built for a calmer relationship with money.{" "}
          <span>PAYPAL AI HACKATHON · 2026</span>
        </footer>
      </main>
    </div>
  );
}
function Expense({ date, editing, onSave }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.target);
        onSave({
          date: f.get("date"),
          description: f.get("description"),
          amount: Math.round(Number(f.get("amount")) * 100),
          bucket: f.get("bucket"),
        });
        if (!editing) e.target.reset();
      }}
    >
      <label>
        Description
        <input
          name="description"
          required
          defaultValue={editing?.description}
          placeholder="What was it for?"
          maxLength={200}
        />
      </label>
      <div className="row">
        <label>
          Amount · INR
          <input
            name="amount"
            type="number"
            min="0.01"
            step="0.01"
            required
            defaultValue={editing ? editing.amount / 100 : undefined}
            placeholder="0.00"
          />
        </label>
        <label>
          Bucket
          <select name="bucket" defaultValue={editing?.bucket || "everyday"}>
            <option value="everyday">Everyday</option>
            <option value="fun">Fun & outings</option>
            <option value="bills">Bills</option>
            <option value="subscriptions">Subscriptions</option>
            <option value="sip">SIP</option>
            <option value="debt">Debt</option>
          </select>
        </label>
      </div>
      <label>
        Date
        <input
          name="date"
          type="date"
          required
          defaultValue={editing?.date || date}
        />
      </label>
      <button className="primary">
        {editing ? "Save changes" : "+ Add expense"}
      </button>
    </form>
  );
}
createRoot(document.getElementById("root")).render(<App />);
