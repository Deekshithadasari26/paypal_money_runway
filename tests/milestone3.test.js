import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed, setSetting } from "../server/db.js";
import { seedPlanner, summary } from "../server/planner.js";
import {
  syncPayPal,
  importPayPal,
  samplePayPal,
  decimalMinor,
  paypalRoutes,
} from "../server/paypal.js";
import { createApp, errors } from "../server/app.js";
test("M3: backend OAuth, all pages, idempotency, original currency and opening exclusion", async () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  setSetting(db, "demoDate", "2026-11-10");
  const before = summary(db).projection.projected;
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (url.includes("oauth2"))
      return Response.json({ access_token: "mock-token" });
    const page = new URL(url).searchParams.get("page");
    return Response.json({
      total_pages: 2,
      transaction_details: [samplePayPal[Number(page) - 1]],
    });
  };
  const window = { start: "2026-11-01T00:00:00Z", end: "2026-11-09T23:59:59Z" },
    env = { PAYPAL_CLIENT_ID: "test", PAYPAL_CLIENT_SECRET: "secret" };
  assert.equal((await syncPayPal(db, window, env, fetcher)).imported, 2);
  assert.equal((await syncPayPal(db, window, env, fetcher)).imported, 0);
  assert.equal(calls.filter((c) => c.url.includes("oauth2")).length, 2);
  assert.match(calls[0].options.headers.Authorization, /^Basic /);
  assert.equal(
    db
      .prepare("SELECT count(*) n FROM transactions WHERE source=?")
      .get("PayPal Sandbox").n,
    2,
  );
  const opening = db
    .prepare("SELECT * FROM transactions WHERE kind='opening'")
    .get();
  assert.equal(opening.amount, 500000);
  assert.equal(opening.currency, "USD");
  assert.equal(summary(db).projection.projected, before);
  assert.equal(decimalMinor("12.30", "INR"), 1230);
  assert.equal(decimalMinor("5000", "JPY"), 5000);
  assert.throws(() => decimalMinor("1.123", "INR"));
  await assert.rejects(
    () => syncPayPal(db, window, {}, fetcher),
    /credentials missing/,
  );
  const sync = db
    .prepare("SELECT value FROM settings WHERE key='paypalSync'")
    .get().value;
  await assert.rejects(() =>
    syncPayPal(db, window, env, async (url) =>
      url.includes("oauth2")
        ? Response.json({ access_token: "t" })
        : new Response("", { status: 500 }),
    ),
  );
  assert.equal(
    db.prepare("SELECT value FROM settings WHERE key='paypalSync'").get().value,
    sync,
  );
  db.close();
});
test("M3: manual settlement retry counts once; opening cannot match", async () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  setSetting(db, "demoDate", "2026-11-10");
  importPayPal(db, samplePayPal);
  const app = createApp(db);
  paypalRoutes(app, db);
  errors(app);
  const server = app.listen(0),
    base = `http://127.0.0.1:${server.address().port}/api`;
  const p = db
    .prepare(
      "SELECT * FROM transactions WHERE source='PayPal Sandbox' AND kind='income'",
    )
    .get();
  const body = {
    paypal_id: p.id,
    date: "2026-11-10",
    amount: 980000,
    bucket: "everyday",
  };
  const post = (path, body) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  try {
    const before = summary(db).cash;
    assert.ok((await post("/paypal/settlement", body)).ok);
    assert.ok((await post("/paypal/settlement", body)).ok);
    assert.equal(summary(db).cash, before + 980000);
    const opening = db
      .prepare("SELECT * FROM transactions WHERE kind='opening'")
      .get();
    assert.equal(
      (await post("/paypal/settlement", { ...body, paypal_id: opening.id }))
        .status,
      400,
    );
  } finally {
    server.close();
    db.close();
  }
});
