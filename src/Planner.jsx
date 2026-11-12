import React, { useState } from "react";
import { api, money, minor } from "./lib";
export default function Planner({ p, run, setNotice }) {
  const [edit, setEdit] = useState(null);
  return (
    <>
      <div className="stats">
        <article>
          <p>CASH SAVINGS FROM THIS SALARY</p>
          <h2>{money(p.savings)}</h2>
          <small>After allocations · {p.date.slice(0, 7)}</small>
        </article>
        <article>
          <p>PROJECTED CASH BY {p.end}</p>
          <h2>{money(p.projection.projected)}</h2>
          <small>Opening cash + all inflows − all outflows</small>
        </article>
      </div>
      {p.paydayTomorrow && (
        <div className="notice">
          ✧ Your salary is expected tomorrow · {money(p.plan.salary)}
        </div>
      )}
      <div className="grid">
        <div>
          <section className="panel">
            <h3>
              A place for every rupee{" "}
              <small>Salary {money(p.actualSalary)}</small>
            </h3>
            {p.allocations.map((a, i) => (
              <div className="allocation" key={a.key}>
                <span className={"dot d" + i} />
                <div>
                  <strong>{a.name}</strong>
                  <progress
                    value={Math.min(a.spent, a.amount)}
                    max={a.amount || 1}
                  />
                  <small>{money(a.spent)} recorded</small>
                </div>
                <b>{money(a.amount)}</b>
              </div>
            ))}
            <p className="muted">
              Reservations guide your plan. Only recorded payments change actual
              cash.
            </p>
          </section>
          <section className="panel">
            <h3>Upcoming commitments</h3>
            {p.slots
              .filter(
                (s) =>
                  s.kind === "expense" &&
                  (!s.matched || s.date >= p.date.slice(0, 7) + "-01"),
              )
              .map((s) => (
                <Bill key={s.key} s={s} p={p} run={run} />
              ))}
            <h3>{edit ? "Edit commitment" : "Add a recurring commitment"}</h3>
            <form
              key={edit?.id || "new"}
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                run(async () => {
                  await api(
                    "/commitments" + (edit ? "/" + edit.id : ""),
                    {
                      name: f.get("name"),
                      amount: minor(f.get("amount")),
                      day: Number(f.get("day")),
                      bucket: f.get("bucket"),
                    },
                    edit ? "PUT" : "POST",
                  );
                  setEdit(null);
                  setNotice("Commitment saved");
                });
              }}
            >
              <label>
                Name
                <input
                  name="name"
                  required
                  defaultValue={edit?.name}
                  placeholder="e.g. Loan minimum"
                />
              </label>
              <div className="row">
                <label>
                  Amount · INR
                  <input
                    name="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    defaultValue={edit?.amount / 100 || ""}
                  />
                </label>
                <label>
                  Due day of month
                  <input
                    name="day"
                    type="number"
                    min="1"
                    max="31"
                    required
                    defaultValue={edit?.day || 15}
                  />
                </label>
              </div>
              <label>
                Type
                <select name="bucket" defaultValue={edit?.bucket || "bills"}>
                  <option value="bills">Bill</option>
                  <option value="debt">Debt minimum</option>
                  <option value="subscriptions">Subscription</option>
                  <option value="sip">SIP</option>
                </select>
              </label>
              <button className="primary">Save commitment</button>
            </form>
            <div className="row">
              {p.commitments.map((c) => (
                <button className="text" key={c.id} onClick={() => setEdit(c)}>
                  Edit {c.name}
                </button>
              ))}
            </div>
          </section>
        </div>
        <div>
          <section className="panel">
            <h3>Your payday plan</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                run(async () => {
                  await api(
                    "/plan",
                    {
                      ...p.plan,
                      baseDate: f.get("baseDate"),
                      opening: minor(f.get("opening")),
                      salary: minor(f.get("salary")),
                      payday: Number(f.get("payday")),
                      everyday: minor(f.get("everyday")),
                      fun: minor(f.get("fun")),
                      buffer: minor(f.get("buffer")),
                    },
                    "PUT",
                  );
                  setNotice("Plan updated");
                });
              }}
            >
              {[
                ["salary", "Expected monthly salary"],
                ["opening", "Opening INR cash"],
                ["everyday", "Monthly everyday allocation"],
                ["fun", "Monthly Fun allocation"],
                ["buffer", "Chosen cash buffer"],
              ].map(([k, l]) => (
                <label key={k}>
                  {l}
                  <input
                    name={k}
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    defaultValue={p.plan[k] / 100}
                  />
                </label>
              ))}
              <label>
                Opening cash as of (start of day)
                <input
                  name="baseDate"
                  type="date"
                  required
                  defaultValue={p.plan.baseDate}
                />
              </label>
              <label>
                Payday · day of month
                <input
                  name="payday"
                  type="number"
                  min="1"
                  max="31"
                  required
                  defaultValue={p.plan.payday}
                />
              </label>
              <button className="primary">Update plan</button>
            </form>
          </section>
          <section className="panel">
            <h3>Record salary</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.target);
                run(async () => {
                  await api("/salary", {
                    date: f.get("date"),
                    plan_date: f.get("plan_date"),
                    amount: minor(f.get("amount")),
                  });
                  setNotice("Salary recorded; expected inflow replaced.");
                });
              }}
            >
              <label>
                Actual amount · INR
                <input
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                  defaultValue={p.plan.salary / 100}
                />
              </label>
              <label>
                Actual received date
                <input name="date" type="date" required defaultValue={p.date} />
              </label>
              <label>
                Matches expected payday
                <select name="plan_date">
                  {p.slots
                    .filter((s) => s.kind === "income")
                    .map((s) => (
                      <option key={s.key} value={s.date}>
                        {s.date}
                        {s.matched ? " · recorded (update)" : ""}
                      </option>
                    ))}
                </select>
              </label>
              <button className="primary">Record Salary</button>
            </form>
          </section>
        </div>
      </div>
      <Assumptions p={p} />
    </>
  );
}
function Bill({ s, p, run }) {
  const [match, setMatch] = useState("");
  return (
    <div className="bill">
      <div>
        <strong>{s.name}</strong>
        <small>
          {s.date} · {s.bucket} · {s.matched ? "Paid" : "Reserved"}
        </small>
      </div>
      <b>{money(s.amount)}</b>
      {!s.matched && (
        <>
          <select
            aria-label={"Match " + s.name + " " + s.date}
            value={match}
            onChange={(e) => setMatch(e.target.value)}
          >
            <option value="">Record new payment</option>
            {p.transactions
              .filter(
                (t) =>
                  t.kind === "expense" &&
                  t.amount === s.amount &&
                  t.bucket === s.bucket &&
                  !t.commitment_id,
              )
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.date} · {t.description}
                </option>
              ))}
          </select>
          <button
            className="secondary"
            onClick={() =>
              run(() =>
                api("/bills/" + s.id + "/pay", {
                  date: p.date,
                  plan_date: s.date,
                  ...(match ? { transaction_id: Number(match) } : {}),
                }),
              )
            }
          >
            Confirm paid
          </button>
        </>
      )}
    </div>
  );
}
export function Assumptions({ p }) {
  return (
    <section className="panel">
      <h3>
        Behind the projection <small>Through {p.end} inclusive</small>
      </h3>
      <div className="totals">
        {Object.entries(p.projection.totals).map(([k, v]) => (
          <div key={k}>
            <small>{k.replace(/([A-Z])/g, " $1")}</small>
            <b>{money(v)}</b>
          </div>
        ))}
      </div>
      <ul className="assumptions">
        {p.assumptions.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </section>
  );
}
