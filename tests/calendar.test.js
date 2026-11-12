import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed, setSetting } from "../server/db.js";
import { seedPlanner, summary } from "../server/planner.js";
import { calendarData } from "../server/calendar.js";
const setup = () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  setSetting(db, "demoDate", "2026-11-10");
  return db;
};
test("Calendar daily allowance, wallet, payday events and exact forecast agree", () => {
  const db = setup(),
    c = calendarData(db);
  assert.equal(c.days.length, 30);
  assert.equal(c.cash, 550000);
  const today = c.days.find((d) => d.date === "2026-11-10");
  assert.equal(today.left, 30000);
  assert.equal(today.spent, 50000);
  assert.equal(today.events.length, 3);
  assert.equal(
    c.days
      .find((d) => d.date === "2026-11-11")
      .events.find((e) => e.type === "expected").amount,
    10000000,
  );
  assert.equal(c.remainingEveryday, 30000);
  assert.equal(c.daysUntilPayday, 1);
  assert.equal(c.firstShortfall, null);
  const next = calendarData(db, { month: "2026-12" });
  assert.equal(next.days.length, 31);
  assert.equal(next.days.at(-1).cash, summary(db).projection.projected);
  assert.equal(c.days[0].cash, null);
  assert.throws(() => calendarData(db, { month: "2027-01" }));
  db.close();
});
test("Calendar explains delayed-income shortfall and updates saved expenses", () => {
  const db = setup();
  const c = calendarData(db, { delayed: true });
  assert.equal(c.firstShortfall.date, "2026-11-12");
  assert.equal(
    c.days
      .find((d) => d.date === "2026-11-18")
      .events.find((e) => e.amount === 10000000).name,
    "Expected salary",
  );
  assert.equal(
    c.days
      .find((d) => d.date === "2026-11-11")
      .events.filter((e) => e.amount > 0).length,
    0,
  );
  db.prepare("UPDATE transactions SET amount=45000 WHERE id=3").run();
  const updated = calendarData(db).days.find((d) => d.date === "2026-11-10");
  assert.equal(updated.left, -5000);
  assert.equal(updated.spent, 85000);
  assert.equal(updated.cash, summary(db).projection.points[0].balance);
  db.close();
});

test("Calendar handles payday today and moves spending horizon with delayed salary", () => {
  const db = setup();
  setSetting(db, "demoDate", "2026-11-11");
  const normal = calendarData(db);
  assert.equal(normal.daysUntilPayday, 1);
  assert.equal(normal.remainingEveryday, 80000);
  const delayed = calendarData(db, { delayed: true });
  assert.equal(delayed.nextPayday, "2026-11-18");
  assert.equal(delayed.daysUntilPayday, 7);
  assert.equal(delayed.remainingEveryday, 560000);
  db.close();
});
