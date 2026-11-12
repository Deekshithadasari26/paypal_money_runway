import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed, daily } from "../server/db.js";
import { createApp, errors } from "../server/app.js";
test("M1: seed, edit, CSV dedup, overspend, fun, recap and persistence", async () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  assert.equal(daily(db, "2026-11-10").left, 30000);
  const app = createApp(db);
  errors(app);
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api`;
  async function post(path, body, method = "POST") {
    const r = await fetch(url + path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    assert.equal(r.ok, true, await r.clone().text());
    return r.json();
  }
  try {
    const e = {
      date: "2026-11-10",
      description: "Dinner",
      amount: 35000,
      bucket: "everyday",
    };
    const { id } = await post("/expenses", e);
    assert.equal(daily(db, e.date).left, -5000);
    await post("/expenses/" + id, { ...e, amount: 20000 }, "PUT");
    assert.equal(daily(db, e.date).left, 10000);
    await post("/expenses", { ...e, bucket: "fun", amount: 10000 });
    assert.equal(daily(db, e.date).left, 10000);
    const csv =
      "id,date,description,amount,currency,bucket\na,2026-11-10,UPI,10.25,INR,everyday";
    assert.equal((await post("/import-csv", { csv })).imported, 1);
    assert.equal((await post("/import-csv", { csv })).imported, 0);
    assert.match((await post("/recap", { date: e.date })).body, /Everyday/);
    assert.equal(
      (await fetch(url + "/today?date=" + e.date).then((r) => r.json())).left,
      8975,
    );
    assert.equal(db.prepare("SELECT count(*) AS n FROM recaps").get().n, 1);
  } finally {
    server.close();
    db.close();
  }
});
