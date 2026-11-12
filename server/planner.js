import { z } from "zod";
import { getSetting, setSetting, todayIST } from "./db.js";
import { dateSchema } from "./app.js";
export const addDays = (date, n) =>
  new Date(Date.parse(date + "T00:00:00Z") + n * 86400000)
    .toISOString()
    .slice(0, 10);
export const monthEnd = (date, offset = 0) => {
  const [y, m] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m + offset, 0)).toISOString().slice(0, 10);
};
export const dayInMonth = (month, day) =>
  `${month.slice(0, 7)}-${String(Math.min(day, Number(monthEnd(month).slice(8)))).padStart(2, "0")}`;
export const defaultPlan = (date) => ({
  baseDate: date,
  opening: 600000,
  salary: 10000000,
  payday: Number(addDays(date, 1).slice(8)),
  everyday: 2400000,
  fun: 800000,
  buffer: 500000,
});
export function seedPlanner(db, date = todayIST()) {
  if (getSetting(db, "plan", null)) return;
  setSetting(db, "plan", defaultPlan(date));
  for (const [name, amount, day, bucket] of [
    ["Rent", 2800000, 12, "bills"],
    ["EMI minimum", 800000, 15, "debt"],
    ["Insurance", 200000, 20, "bills"],
    ["Stream Plus", 200000, 18, "subscriptions"],
    ["Mutual fund SIP", 1000000, 13, "sip"],
  ])
    db.prepare(
      "INSERT INTO commitments(name,amount,day,bucket) VALUES(?,?,?,?)",
    ).run(name, amount, day, bucket);
}
export function planData(db, date = getSetting(db, "demoDate", todayIST())) {
  const plan = getSetting(db, "plan", defaultPlan(date)),
    transactions = db
      .prepare(
        "SELECT * FROM transactions WHERE currency='INR' AND source NOT LIKE 'PayPal%' AND status='posted' AND kind!='opening'",
      )
      .all();
  const commitments = db
    .prepare("SELECT * FROM commitments ORDER BY day,id")
    .all();
  const end = monthEnd(date, 1),
    start = plan.baseDate;
  const actual = transactions.filter((t) => t.date >= start && t.date <= date);
  const cash =
    plan.opening +
    actual.reduce(
      (s, t) => s + (t.kind === "income" ? t.amount : -t.amount),
      0,
    );
  const slots = [];
  let month = start.slice(0, 7) + "-01";
  // Plans are intentionally limited to at most two years from the opening date.
  for (
    let i = 0;
    month <= (end > addDays(date, 29) ? end : addDays(date, 29)) && i < 25;
    i++
  ) {
    const paydate = dayInMonth(month, plan.payday);
    if (paydate >= start)
      slots.push({
        key: "salary:" + paydate,
        date: paydate,
        amount: plan.salary,
        kind: "income",
        name: "Expected salary",
        matched: transactions.find(
          (t) => t.kind === "income" && t.plan_date === paydate,
        ),
      });
    for (const c of commitments) {
      const due = dayInMonth(month, c.day);
      if (due >= start)
        slots.push({
          ...c,
          id: c.id,
          key: "bill:" + c.id + ":" + due,
          date: due,
          kind: "expense",
          matched: transactions.find(
            (t) => t.commitment_id === c.id && t.plan_date === due,
          ),
        });
    }
    const [y, m] = month.split("-").map(Number);
    month = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
  }
  const currentMonth = date.slice(0, 7);
  const salarySlot = slots.find(
    (s) => s.kind === "income" && s.date.startsWith(currentMonth),
  );
  const actualSalary = salarySlot?.matched?.amount ?? plan.salary;
  const spentBucket = (b) =>
    transactions
      .filter(
        (t) =>
          t.kind === "expense" &&
          t.date.startsWith(currentMonth) &&
          t.bucket === b,
      )
      .reduce((s, t) => s + t.amount, 0);
  const allocations = [
    { key: "everyday", name: "Everyday expenses", amount: plan.everyday },
    {
      key: "bills",
      name: "Rent, EMI & insurance",
      amount: commitments
        .filter((c) => ["bills", "debt"].includes(c.bucket))
        .reduce((s, c) => s + c.amount, 0),
    },
    {
      key: "subscriptions",
      name: "Subscription autopays",
      amount: commitments
        .filter((c) => c.bucket === "subscriptions")
        .reduce((s, c) => s + c.amount, 0),
    },
    { key: "fun", name: "Fun & outings", amount: plan.fun },
    {
      key: "sip",
      name: "Mutual fund SIP",
      amount: commitments
        .filter((c) => c.bucket === "sip")
        .reduce((s, c) => s + c.amount, 0),
    },
  ].map((a) => ({
    ...a,
    spent:
      a.key === "bills"
        ? spentBucket("bills") + spentBucket("debt")
        : spentBucket(a.key),
  }));
  const savings =
    actualSalary -
    allocations.reduce((s, a) => s + Math.max(a.amount, a.spent), 0);
  const nextSalary = slots.find(
    (s) => s.kind === "income" && !s.matched && s.date >= date,
  );
  return {
    date,
    plan,
    transactions,
    commitments,
    slots,
    cash,
    end,
    allocations,
    savings,
    actualSalary,
    nextSalary,
    paydayTomorrow: nextSalary?.date === addDays(date, 1),
  };
}
export function projection(data, { delay = 0, end = data.end } = {}) {
  const { date, plan, slots, transactions } = data;
  const incomeToDelay = slots.find(
    (s) => s.kind === "income" && !s.matched && s.date >= date,
  )?.key;
  const ledger = [];
  for (const t of transactions)
    if (t.date >= plan.baseDate && t.date <= end)
      ledger.push({
        date: t.date,
        amount: t.kind === "income" ? t.amount : -t.amount,
        type: "actual",
        name: t.description,
      });
  for (const s of slots)
    if (!s.matched) {
      // Never treat an overdue, unreceived salary as cash already on hand.
      if (s.kind === "income" && s.date < date) continue;
      const scheduled =
        s.key === incomeToDelay ? addDays(s.date, delay) : s.date;
      const due = scheduled < date ? date : scheduled;
      if (due <= end)
        ledger.push({
          date: due,
          amount: s.kind === "income" ? s.amount : -s.amount,
          type: "planned",
          name: s.name,
        });
    }
  for (let d = date; d <= end; d = addDays(d, 1)) {
    const spent = (b) =>
      transactions
        .filter((t) => t.date === d && t.bucket === b && t.kind === "expense")
        .reduce((s, t) => s + t.amount, 0);
    const funDaily =
      Math.floor(plan.fun / Number(monthEnd(d).slice(8))) +
      (Number(d.slice(8)) <= plan.fun % Number(monthEnd(d).slice(8)) ? 1 : 0);
    ledger.push({
      date: d,
      amount: -Math.max(0, getSettingAllowance(data) - spent("everyday")),
      type: "estimate",
      name: "Remaining everyday allowance",
    });
    ledger.push({
      date: d,
      amount: -Math.max(0, funDaily - spent("fun")),
      type: "estimate",
      name: "Remaining Fun estimate",
    });
  }
  let balance = plan.opening;
  const points = [];
  for (let d = plan.baseDate; d <= end; d = addDays(d, 1)) {
    const events = ledger.filter((e) => e.date === d);
    balance += events.reduce((s, e) => s + e.amount, 0);
    if (d >= date)
      points.push({
        date: d,
        balance,
        inflow: events
          .filter((e) => e.amount > 0)
          .reduce((s, e) => s + e.amount, 0),
        outflow: -events
          .filter((e) => e.amount < 0)
          .reduce((s, e) => s + e.amount, 0),
      });
  }
  const total = (type, positive) =>
    ledger
      .filter(
        (e) => e.type === type && (positive ? e.amount > 0 : e.amount < 0),
      )
      .reduce((s, e) => s + e.amount, 0);
  return {
    points,
    projected: balance,
    firstShortfall: points.find((p) => p.balance < 0) || null,
    minBalance: Math.min(...points.map((p) => p.balance)),
    totals: {
      opening: plan.opening,
      actualIncome: total("actual", true),
      actualOutflow: -total("actual", false),
      plannedIncome: total("planned", true),
      plannedOutflow: -total("planned", false),
      estimatedOutflow: -total("estimate", false),
    },
    ledger,
  };
}
const getSettingAllowance = (data) => data.allowance ?? 80000;
export function summary(db, date) {
  const data = planData(db, date);
  data.allowance = getSetting(db, "allowance", 80000);
  const forecast = projection(data);
  return {
    ...data,
    projection: forecast,
    assumptions: [
      "Opening INR cash is the balance at the start of " +
        data.plan.baseDate +
        ". Actuals on or after that date change cash.",
      "Expected salary repeats monthly on payday. Recorded salary replaces its selected expected payday. Past-due unrecorded salary is excluded until recorded.",
      "Commitments repeat monthly; due days are clamped to month end. Overdue unpaid commitments remain reserved.",
      "Everyday allowance remaining today and full daily allowance thereafter; Fun spread across calendar days. No unrecorded historic spending estimated.",
      "SIP is a cash outflow. Cash savings are unallocated cash, not an extra outflow. All PayPal ledger entries excluded; record their INR settlements once.",
      "Matching a bill replaces its reservation with its actual payment. Foreign currencies are never converted automatically.",
    ],
  };
}
const planSchema = z.object({
  baseDate: dateSchema,
  opening: z.number().int().nonnegative().max(1e11),
  salary: z.number().int().positive().max(1e10),
  payday: z.number().int().min(1).max(31),
  everyday: z.number().int().nonnegative().max(1e10),
  fun: z.number().int().nonnegative().max(1e10),
  buffer: z.number().int().nonnegative().max(1e10),
});
const commitmentSchema = z.object({
  name: z.string().trim().min(1).max(100),
  amount: z.number().int().positive().max(1e10),
  day: z.number().int().min(1).max(31),
  bucket: z.enum(["bills", "debt", "subscriptions", "sip"]),
});
export function plannerRoutes(app, db) {
  app.get("/api/plan", (req, res) =>
    res.json(
      summary(
        db,
        dateSchema.parse(
          req.query.date || getSetting(db, "demoDate", todayIST()),
        ),
      ),
    ),
  );
  app.put("/api/plan", (req, res) => {
    const p = planSchema.parse(req.body);
    const now = getSetting(db, "demoDate", todayIST());
    if (p.baseDate > now || addDays(p.baseDate, 730) < now)
      throw Error("Opening date must be within the previous two years");
    setSetting(db, "plan", p);
    setSetting(db, "allowance", Math.round(p.everyday / 30));
    res.json(summary(db));
  });
  app.put("/api/demo-date", (req, res) => {
    const date = dateSchema.parse(req.body.date),
      p = getSetting(db, "plan");
    if (date < p.baseDate || date > addDays(p.baseDate, 700))
      throw Error("Demo date must be between opening date and 700 days later");
    setSetting(db, "demoDate", date);
    res.json({ date });
  });
  app.post("/api/commitments", (req, res) => {
    const c = commitmentSchema.parse(req.body);
    db.prepare(
      "INSERT INTO commitments(name,amount,day,bucket) VALUES(?,?,?,?)",
    ).run(c.name, c.amount, c.day, c.bucket);
    res.status(201).json({ ok: true });
  });
  app.put("/api/commitments/:id", (req, res) => {
    const c = commitmentSchema.parse(req.body);
    const r = db
      .prepare(
        "UPDATE commitments SET name=?,amount=?,day=?,bucket=? WHERE id=?",
      )
      .run(c.name, c.amount, c.day, c.bucket, Number(req.params.id));
    if (!r.changes) throw Error("Commitment not found");
    res.json({ ok: true });
  });
  app.post("/api/salary", (req, res) => {
    const v = z
      .object({
        amount: z.number().int().positive().max(1e10),
        date: dateSchema,
        plan_date: dateSchema,
      })
      .parse(req.body);
    const data = planData(db);
    if (!data.slots.some((s) => s.kind === "income" && s.date === v.plan_date))
      throw Error("Select an expected payday");
    const key = "salary:" + v.plan_date;
    db.prepare(
      "INSERT INTO transactions(external_key,date,description,amount,bucket,kind,source,plan_date) VALUES(?,?,?,?,?,'income','Manual',?) ON CONFLICT(external_key) DO UPDATE SET amount=excluded.amount,date=excluded.date",
    ).run(key, v.date, "Salary received", v.amount, "salary", v.plan_date);
    res.json({ ok: true });
  });
  app.post("/api/bills/:id/pay", (req, res) => {
    const v = z
      .object({
        date: dateSchema,
        plan_date: dateSchema,
        transaction_id: z.number().int().optional(),
      })
      .parse(req.body);
    const c = db
      .prepare("SELECT * FROM commitments WHERE id=?")
      .get(Number(req.params.id));
    if (!c) throw Error("Bill not found");
    if (
      !planData(db).slots.some(
        (s) => s.kind === "expense" && s.id === c.id && s.date === v.plan_date,
      )
    )
      throw Error("Unknown bill due date");
    const existing = db
      .prepare(
        "SELECT id FROM transactions WHERE commitment_id=? AND plan_date=?",
      )
      .get(c.id, v.plan_date);
    if (existing)
      return res.json({ ok: true, id: existing.id, alreadyPaid: true });
    if (v.transaction_id) {
      const t = db
        .prepare(
          "SELECT * FROM transactions WHERE id=? AND currency='INR' AND kind='expense' AND source NOT LIKE 'PayPal%' AND commitment_id IS NULL AND amount=? AND bucket=?",
        )
        .get(v.transaction_id, c.amount, c.bucket);
      if (!t)
        throw Error(
          "Select an unmatched INR payment with the same amount and bucket",
        );
      db.prepare(
        "UPDATE transactions SET commitment_id=?,plan_date=? WHERE id=?",
      ).run(c.id, v.plan_date, t.id);
    } else
      db.prepare(
        "INSERT INTO transactions(external_key,date,description,amount,bucket,source,commitment_id,plan_date) VALUES(?,?,?,?,?,'Confirmed bill',?,?)",
      ).run(
        "bill:" + c.id + ":" + v.plan_date,
        v.date,
        c.name,
        c.amount,
        c.bucket,
        c.id,
        v.plan_date,
      );
    res.json({ ok: true });
  });
}
