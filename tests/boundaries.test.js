import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed, setSetting, daily, getSetting } from "../server/db.js";
import {
  seedPlanner,
  summary,
  monthEnd,
  dayInMonth,
} from "../server/planner.js";
import { forecast } from "../server/forecast.js";
import { importPayPal, samplePayPal } from "../server/paypal.js";
test("Calendar boundaries and 30-day forecast across February", () => {
  assert.equal(monthEnd("2027-01-31", 1), "2027-02-28");
  assert.equal(dayInMonth("2028-02-01", 31), "2028-02-29");
  const db = openDb(":memory:");
  seed(db, "2027-01-31");
  seedPlanner(db, "2027-01-31");
  setSetting(db, "demoDate", "2027-01-31");
  const f = forecast(db);
  assert.equal(f.base.length, 30);
  assert.equal(f.base.at(-1).date, "2027-03-01");
  assert.equal(summary(db).end, "2027-02-28");
  db.close();
});
test("Overdue unreceived salary does not masquerade as actual cash", () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  setSetting(db, "demoDate", "2026-11-12");
  const p = summary(db);
  assert.equal(p.cash, 550000);
  assert.equal(p.projection.totals.plannedIncome, 10000000);
  assert.ok(p.projection.firstShortfall);
  assert.equal(p.nextSalary.date, "2026-12-11");
  db.close();
});
test("PayPal activity remains off Today INR ledger and all daily spending", () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  importPayPal(db, samplePayPal);
  const d = daily(db, "2026-11-10");
  assert.equal(d.transactions.length, 3);
  assert.equal(d.left, 30000);
  assert.equal(d.fun, 0);
  db.close();
});
