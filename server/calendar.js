import { summary, projection, monthEnd, addDays } from "./planner.js";
import { daily } from "./db.js";
import { z } from "zod";

export function calendarData(db, { month, delayed = false } = {}) {
  const p = summary(db);
  month = month || p.date.slice(0, 7);
  if (![p.date.slice(0, 7), p.end.slice(0, 7)].includes(month))
    throw Error("Choose this month or next month");
  const start = month + "-01",
    end = monthEnd(start);
  const forecast = projection(p, { delay: delayed ? 7 : 0 });
  const days = [];
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const beforeOpening = date < p.plan.baseDate;
    const actual = daily(db, date);
    const point = forecast.points.find((d) => d.date === date);
    const transactions = p.transactions.filter((t) => t.date === date);
    const cashBefore =
      p.plan.opening +
      p.transactions
        .filter((t) => t.date >= p.plan.baseDate && t.date < date)
        .reduce((s, t) => s + (t.kind === "income" ? t.amount : -t.amount), 0);
    const historicCash =
      cashBefore +
      transactions.reduce(
        (s, t) => s + (t.kind === "income" ? t.amount : -t.amount),
        0,
      );
    const entries = forecast.ledger.filter((e) => e.date === date);
    const events = [
      ...transactions.map((t) => ({
        name: t.description,
        amount: t.kind === "income" ? t.amount : -t.amount,
        type: "recorded",
        bucket: t.bucket,
      })),
      ...entries
        .filter((e) => e.type === "planned")
        .map((e) => ({
          name: e.name,
          amount: e.amount,
          type: "expected",
          bucket: e.amount > 0 ? "income" : "commitment",
        })),
    ];
    const overdue = p.slots
      .filter(
        (s) =>
          s.date === date &&
          s.kind === "income" &&
          !s.matched &&
          s.date < p.date,
      )
      .map((s) => ({
        name: "Salary not recorded · excluded from cash",
        amount: s.amount,
        type: "overdue",
        bucket: "income",
      }));
    days.push({
      date,
      beforeOpening,
      isToday: date === p.date,
      isFuture: date > p.date,
      allowance: actual.allowance,
      spent: actual.spent,
      left: actual.left,
      fun: actual.fun,
      cash: beforeOpening ? null : (point?.balance ?? historicCash),
      projected: date >= p.date,
      events: beforeOpening ? [] : [...events, ...overdue],
      estimates: entries.filter((e) => e.type === "estimate"),
      inflow:
        point?.inflow ??
        transactions
          .filter((t) => t.kind === "income")
          .reduce((s, t) => s + t.amount, 0),
      outflow:
        point?.outflow ??
        transactions
          .filter((t) => t.kind === "expense")
          .reduce((s, t) => s + t.amount, 0),
    });
  }
  const payday = p.nextSalary
    ? addDays(p.nextSalary.date, delayed ? 7 : 0)
    : null;
  const runwayEnd = payday
    ? payday > p.date
      ? addDays(payday, -1)
      : p.date
    : p.end;
  let remainingEveryday = 0,
    daysUntilPayday = 0;
  for (let date = p.date; date <= runwayEnd; date = addDays(date, 1)) {
    remainingEveryday += Math.max(0, daily(db, date).left);
    daysUntilPayday++;
  }
  return {
    date: p.date,
    month,
    end,
    horizon: p.end,
    months: [p.date.slice(0, 7), p.end.slice(0, 7)],
    cash: p.cash,
    allowance: daily(db, p.date).allowance,
    remainingEveryday,
    daysUntilPayday,
    nextPayday: payday || null,
    delayed,
    firstShortfall: forecast.firstShortfall,
    buffer: p.plan.buffer,
    days,
    assumption:
      "Past dates show recorded closing INR cash. Today and future dates show projected closing cash including remaining everyday/Fun estimates and unmatched commitments. Expected income is not guaranteed. PayPal foreign activity is excluded.",
  };
}
export function calendarRoutes(app, db) {
  app.get("/api/calendar", (req, res) => {
    const query = z
      .object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}$/)
          .optional(),
        delayed: z.enum(["true", "false"]).optional(),
      })
      .parse(req.query);
    res.json(
      calendarData(db, {
        month: query.month,
        delayed: query.delayed === "true",
      }),
    );
  });
}
