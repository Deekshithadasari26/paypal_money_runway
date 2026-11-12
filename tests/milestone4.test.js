import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed, setSetting, getSetting } from "../server/db.js";
import { seedPlanner } from "../server/planner.js";
import {
  forecast,
  aiFacts,
  insights,
  redactDescription,
  validateInsight,
} from "../server/forecast.js";
function setup() {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  setSetting(db, "demoDate", "2026-11-10");
  return db;
}
test("M4: 30 days, delayed income shortfall, deterministic math, buffer-safe extra", () => {
  const db = setup();
  const f = forecast(db);
  assert.equal(f.base.length, 30);
  assert.equal(f.delayed.length, 30);
  assert.equal(f.shortfall, null);
  assert.equal(f.delayedShortfall.date, "2026-11-12");
  assert.ok(f.delayedShortfall.balance < 0);
  assert.equal(f.expectedIncome.delayed, "2026-11-18");
  assert.deepEqual(forecast(db), f);
  const p = getSetting(db, "plan");
  setSetting(db, "plan", { ...p, opening: 10000000 });
  const g = forecast(db);
  assert.ok(g.extra > 0);
  assert.ok(g.cash - g.extra >= g.buffer);
  assert.ok(g.baseMinimum - g.extra >= g.buffer);
  db.close();
});
test("M4: privacy allowlist, no model fallback, model failure and invalid JSON", async () => {
  const db = setup();
  db.prepare(
    "INSERT INTO transactions(date,description,amount,bucket,source) VALUES(?,?,?,?,?)",
  ).run(
    "2026-11-10",
    "Coffee Alice alice@example.com +91 9999999999 UPI abc@bank a/c123456789",
    10000,
    "everyday",
    "Manual",
  );
  const facts = aiFacts(db);
  assert.doesNotMatch(
    JSON.stringify(facts),
    /Alice|alice@example|999999|abc@bank|123456789/,
  );
  assert.equal(redactDescription("Alice paid 9999"), "[description redacted]");
  let r = await insights(db, { env: {} });
  assert.equal(r.mode, "fallback");
  r = await insights(db, {
    env: { OPENAI_API_KEY: "test" },
    fetcher: async () => {
      throw Error("offline");
    },
  });
  assert.equal(r.mode, "fallback");
  r = await insights(db, {
    env: { OPENAI_API_KEY: "test" },
    fetcher: async () =>
      Response.json({
        status: "completed",
        output: [{ content: [{ type: "output_text", text: '{"oops":true}' }] }],
      }),
  });
  assert.equal(r.mode, "fallback");
  assert.throws(() =>
    validateInsight(
      {
        explanation: "test",
        categories: [{ ref: "unknown", category: "fun", reason: "x" }],
        subscription: null,
      },
      facts,
    ),
  );
  db.close();
});
test("M4: valid structured model output uses only backend redacted facts", async () => {
  const db = setup();
  let payload;
  const value = {
    explanation: "An income delay affects cash timing.",
    categories: [{ ref: "t1", category: "everyday", reason: "Food" }],
    subscription: {
      ref: "subscription-4",
      message: "Hello, can you share a lower-cost plan?",
    },
  };
  const r = await insights(db, {
    env: { OPENAI_API_KEY: "mock-key" },
    fetcher: async (url, opts) => {
      payload = JSON.parse(opts.body);
      return Response.json({
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: JSON.stringify(value) }] },
        ],
      });
    },
  });
  assert.equal(r.mode, "model");
  assert.equal(payload.store, false);
  assert.equal(payload.text.format.type, "json_schema");
  assert.doesNotMatch(payload.input, /Lunch at the office|Stream Plus/);
  db.close();
});

test("M4: savings projection changes have backend-computed component deltas", async () => {
  const db = setup();
  await insights(db, { env: {} });
  db.prepare(
    "INSERT INTO transactions(date,description,amount,bucket,source) VALUES(?,?,?,?,?)",
  ).run("2026-11-10", "Dinner", 40000, "everyday", "Manual");
  const result = await insights(db, { env: {} });
  assert.equal(result.facts.changes.projectionDelta, -10000);
  assert.equal(result.facts.changes.componentDeltas.actualOutflow, 40000);
  assert.equal(result.facts.changes.componentDeltas.estimatedOutflow, -30000);
  assert.match(result.result.explanation, /recorded outflows increased/);
  db.close();
});
