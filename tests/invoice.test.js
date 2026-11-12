import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../server/db.js";
import { createApp, errors } from "../server/app.js";
import { invoiceRoutes } from "../server/invoice.js";
async function setup(fetcher) {
  const db = openDb(":memory:"),
    app = createApp(db);
  invoiceRoutes(app, db, {
    env: {
      PAYPAL_CLIENT_ID: "test",
      PAYPAL_CLIENT_SECRET: "secret",
      PAYPAL_INVOICER_EMAIL: "merchant@example.com",
    },
    fetcher,
  });
  errors(app);
  const server = app.listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api`;
  const post = async (path, body) => {
    const r = await fetch(url + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: r.status, ...(await r.json()) };
  };
  return { db, server, post };
}
const draft = {
  customer: "buyer@example.com",
  description: "Completed test design work",
  amount: 12000,
  completed: true,
};
test("Optional invoice: explicit approval, durable retry and concurrency protection", async () => {
  let creates = 0,
    requestId;
  const { db, server, post } = await setup(async (url, o) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "mock" });
    creates++;
    requestId = o.headers["PayPal-Request-Id"];
    return Response.json({ id: "INV2-TEST-1234" });
  });
  try {
    const a = await post("/invoice/review", draft),
      b = await post("/invoice/review", draft);
    assert.equal(a.id, b.id);
    assert.equal(creates, 0);
    assert.equal(
      (await post("/invoice/" + a.id + "/approve", { approved: false })).status,
      400,
    );
    const results = await Promise.all([
      post("/invoice/" + a.id + "/approve", { approved: true }),
      post("/invoice/" + a.id + "/approve", { approved: true }),
    ]);
    assert.ok(results.some((r) => r.invoice_id === "INV2-TEST-1234"));
    const retry = await post("/invoice/" + a.id + "/approve", {
      approved: true,
    });
    assert.equal(retry.invoice_id, "INV2-TEST-1234");
    assert.equal(creates, 1);
    assert.ok(requestId);
  } finally {
    server.close();
    db.close();
  }
});
test("Optional invoice: uncertain remote outcome blocks duplicate creation", async () => {
  let creates = 0;
  const { db, server, post } = await setup(async (url) => {
    if (url.includes("oauth2")) return Response.json({ access_token: "mock" });
    creates++;
    throw Error("network timeout");
  });
  try {
    const a = await post("/invoice/review", draft);
    assert.equal(
      (await post("/invoice/" + a.id + "/approve", { approved: true })).status,
      502,
    );
    assert.equal(
      (await post("/invoice/" + a.id + "/approve", { approved: true })).status,
      409,
    );
    assert.equal(creates, 1);
  } finally {
    server.close();
    db.close();
  }
});
