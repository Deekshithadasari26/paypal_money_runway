import React, { useState, useEffect } from "react";
import { api, money } from "./lib";
const pretty = (date) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date + "T00:00:00Z"));
const monthTitle = (month) =>
  new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "long",
    year: "numeric",
  }).format(new Date(month + "-01T00:00:00Z"));
export default function Calendar({ date, setNotice }) {
  const [month, setMonth] = useState(date.slice(0, 7)),
    [delayed, setDelayed] = useState(false),
    [data, setData] = useState(null),
    [selected, setSelected] = useState(date);
  useEffect(() => {
    let active = true;
    api("/calendar?month=" + month + "&delayed=" + delayed)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => setNotice(e.message));
    return () => {
      active = false;
    };
  }, [month, delayed, date]);
  if (!data) return <p>Building your money calendar…</p>;
  const day =
    data.days.find((d) => d.date === selected) ||
    data.days.find((d) => !d.beforeOpening) ||
    data.days[0];
  const offset = (new Date(month + "-01T00:00:00Z").getUTCDay() + 6) % 7;
  return (
    <>
      <div className="stats">
        <article>
          <p>YOUR INR WALLET · RECORDED CASH</p>
          <h2>{money(data.cash)}</h2>
          <small>As of {pretty(data.date)}</small>
        </article>
        <article>
          <p>EVERYDAY PLAN BEFORE SALARY</p>
          <h2>{money(data.remainingEveryday)}</h2>
          <small>
            {money(data.allowance)} daily allowance · {data.daysUntilPayday}{" "}
            days including today
          </small>
          <p className="muted">
            {data.nextPayday
              ? "Salary expected " + pretty(data.nextPayday)
              : "No upcoming salary in this horizon"}
            . This is a spending allocation, not extra cash.
          </p>
        </article>
      </div>
      <section className="panel">
        <div className="calendar-toolbar">
          <div>
            <p className="eyebrow">KNOW WHEN. UNDERSTAND WHY.</p>
            <h3>Your money calendar</h3>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={delayed}
              onChange={(e) => setDelayed(e.target.checked)}
            />
            Delay next expected salary by 7 days
          </label>
        </div>
        <div className="calendar-months" aria-label="Calendar month">
          {data.months.map((m) => (
            <button
              key={m}
              className={m === month ? "primary" : "secondary"}
              aria-pressed={m === month}
              onClick={() => {
                setMonth(m);
                setSelected(m === date.slice(0, 7) ? date : m + "-01");
              }}
            >
              {monthTitle(m)}
            </button>
          ))}
        </div>
        <div className="calendar-legend">
          <span>● Spending within allowance</span>
          <span>↗ Income expected</span>
          <span>↓ Bill / SIP due</span>
          <span className="calendar-danger">
            ! Cash shortfall or overspending
          </span>
        </div>
        <div
          className="calendar-grid"
          aria-label={monthTitle(month) + " spending calendar"}
        >
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div className="weekday" key={d}>
              {d}
            </div>
          ))}
          {Array.from({ length: offset }, (_, i) => (
            <div key={"blank" + i} aria-hidden="true" />
          ))}
          {data.days.map((d) => (
            <button
              key={d.date}
              disabled={d.beforeOpening}
              className={
                "calendar-day " +
                (d.date === day.date ? "selected " : "") +
                (d.isToday ? "today " : "") +
                (d.cash < 0 || d.left < 0 ? "danger " : "")
              }
              aria-pressed={d.date === day.date}
              aria-label={`${pretty(d.date)}. ${d.beforeOpening ? "Before opening balance" : `${d.isFuture ? "Allowance remaining" : "Everyday left"} ${money(d.left)}. ${d.projected ? "Projected" : "Recorded"} cash ${money(d.cash)}. ${d.events.length} events.`}`}
              onClick={() => setSelected(d.date)}
            >
              <span className="day-number">
                {Number(d.date.slice(8))}
                {d.isToday && <small>Today</small>}
              </span>
              {!d.beforeOpening && (
                <>
                  <strong>{money(d.left)}</strong>
                  <span className="day-caption">
                    {d.left < 0
                      ? "overspent"
                      : d.isFuture
                        ? "allowance left"
                        : "everyday left"}
                  </span>
                  <span className="day-events">
                    {d.events.some(
                      (e) => e.amount > 0 && e.type !== "overdue",
                    ) && "↗ Income "}
                    {d.events.some((e) => e.amount < 0) && "↓ Spend / bills"}
                    {d.events.some((e) => e.type === "overdue") &&
                      "! Salary overdue"}
                  </span>
                  {d.cash < 0 && (
                    <span className="day-warning">Cash shortfall</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
        <p className="muted">
          Each tile shows the everyday allowance left, not your wallet balance.
          Select a day to see cash, payments and the calculation.
        </p>
      </section>
      <div className="grid">
        <section className="panel calendar-detail" aria-live="polite">
          <p className="eyebrow">{pretty(day.date)}</p>
          <h3>
            {day.projected ? "Projected closing cash" : "Recorded closing cash"}
          </h3>
          <h2>{day.cash === null ? "—" : money(day.cash)}</h2>
          <p className="muted">
            {day.projected
              ? "A forecast based on your plan; no payment is made automatically."
              : "Based only on recorded INR transactions."}
          </p>
          <div className="calendar-breakdown">
            <div>
              <small>Everyday allowance</small>
              <b>{money(day.allowance)}</b>
            </div>
            <div>
              <small>Everyday recorded</small>
              <b>{money(day.spent)}</b>
            </div>
            <div>
              <small>Fun recorded separately</small>
              <b>{money(day.fun)}</b>
            </div>
            <div>
              <small>
                {day.projected
                  ? "All expected / recorded inflows"
                  : "Recorded inflows"}
              </small>
              <b>{money(day.inflow)}</b>
            </div>
            <div>
              <small>
                {day.projected
                  ? "All outflows incl. estimates"
                  : "Recorded outflows"}
              </small>
              <b>{money(day.outflow)}</b>
            </div>
          </div>
          <h3>What happens on this day</h3>
          {day.events.length === 0 && (
            <p className="muted">
              No income or bill payments scheduled or recorded.
            </p>
          )}
          {day.events.map((e, i) => (
            <div className="calendar-event" key={i}>
              <div>
                <strong>{e.name}</strong>
                <small>
                  {e.type === "recorded"
                    ? "Recorded · counted once"
                    : e.type === "overdue"
                      ? "Not counted as received"
                      : "Expected · not yet recorded"}
                </small>
              </div>
              <b>
                {e.amount > 0 ? "+" : ""}
                {money(e.amount)}
              </b>
            </div>
          ))}
          {day.projected &&
            day.estimates.map((e, i) => (
              <div className="calendar-event" key={"estimate" + i}>
                <div>
                  <strong>{e.name}</strong>
                  <small>Estimated cash outflow</small>
                </div>
                <b>{money(e.amount)}</b>
              </div>
            ))}
        </section>
        <section className="panel">
          <p className="eyebrow">YOUR RUNWAY SIGNAL</p>
          <h3>
            {delayed
              ? "With a seven-day income delay"
              : "With your original plan"}
          </h3>
          {data.firstShortfall ? (
            <div className="calendar-alert">
              <strong>First projected shortfall</strong>
              <h3>{pretty(data.firstShortfall.date)}</h3>
              <b>{money(data.firstShortfall.balance)}</b>
              <p>
                Expected outflows exceed the cash available by this day. Select
                the date to see the income, commitments and spending estimates
                behind it.
              </p>
              {data.firstShortfall.date.slice(0, 7) !== month ? (
                <button
                  className="secondary"
                  onClick={() => {
                    setMonth(data.firstShortfall.date.slice(0, 7));
                    setSelected(data.firstShortfall.date);
                  }}
                >
                  Show shortfall day
                </button>
              ) : (
                <button
                  className="secondary"
                  onClick={() => setSelected(data.firstShortfall.date)}
                >
                  Show shortfall day
                </button>
              )}
            </div>
          ) : (
            <div className="notice">
              No projected cash shortfall through {pretty(data.horizon)}.
            </div>
          )}
          <p className="muted">
            Chosen cash buffer: {money(data.buffer)}. A positive cash balance
            can still be below this buffer.
          </p>
          <p className="muted">{data.assumption}</p>
          <p className="muted">
            Edit salary and bills in Payday planner; add or edit spending in
            Today. The calendar updates from the same saved records.
          </p>
        </section>
      </div>
    </>
  );
}
