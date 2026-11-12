import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed, setSetting } from "../server/db.js";
import { seedPlanner, summary, plannerRoutes } from "../server/planner.js";
import { createApp, errors } from "../server/app.js";
test("M2: savings, tomorrow, salary replacement, bill match, exact horizon arithmetic", async () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  setSetting(db, "demoDate", "2026-11-10");
  let p = summary(db);
  assert.equal(p.savings, 1800000);
  assert.equal(p.paydayTomorrow, true);
  assert.equal(p.end, "2026-12-31");
  const app = createApp(db);
  plannerRoutes(app, db);
  errors(app);
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const post = async (path, body) => {
    const r = await fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.ok(r.ok, await r.clone().text());
    return r.json();
  };
  try {
    const before = p.projection.projected;
    await post("/salary", {
      date: "2026-11-11",
      plan_date: "2026-11-11",
      amount: 10000000,
    });
    assert.equal(summary(db).projection.projected, before);
    await post("/salary", {
      date: "2026-11-11",
      plan_date: "2026-11-11",
      amount: 9000000,
    });
    assert.equal(summary(db).savings, 800000);
    const bill = p.slots.find((s) => s.name === "Rent");
    const { id } = await post("/expenses", {
      date: "2026-11-12",
      description: "Rent transfer",
      amount: bill.amount,
      bucket: bill.bucket,
    });
    const prior = summary(db).projection.projected;
    await post("/bills/" + bill.id + "/pay", {
      date: "2026-11-12",
      plan_date: bill.date,
      transaction_id: id,
    });
    assert.equal(summary(db).projection.projected, prior + bill.amount);
    await post("/bills/" + bill.id + "/pay", {
      date: "2026-11-12",
      plan_date: bill.date,
    });
    assert.equal(
      db
        .prepare("SELECT count(*) AS n FROM transactions WHERE commitment_id=?")
        .get(bill.id).n,
      1,
    );
    p = summary(db);
    const t = p.projection.totals;
    assert.equal(
      p.projection.projected,
      t.opening +
        t.actualIncome -
        t.actualOutflow +
        t.plannedIncome -
        t.plannedOutflow -
        t.estimatedOutflow,
    );
    await post("/expenses", {
      date: "2026-11-10",
      description: "Big outing",
      amount: 900000,
      bucket: "fun",
    });
    assert.equal(summary(db).savings, 700000);
  } finally {
    server.close();
    db.close();
  }
});
