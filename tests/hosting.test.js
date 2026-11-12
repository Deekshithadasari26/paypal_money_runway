import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb, seed } from "../server/db.js";
import { seedPlanner } from "../server/planner.js";
import { createRuntime } from "../server/runtime.js";
test("Hosted demo: fail closed without password, health public, APIs protected, HTTPS same-origin writes work", async () => {
  const db = openDb(":memory:");
  seed(db, "2026-11-10");
  seedPlanner(db, "2026-11-10");
  assert.throws(
    () => createRuntime(db, { env: { NODE_ENV: "production" } }),
    /DEMO_PASSWORD/,
  );
  const env = {
    NODE_ENV: "production",
    DEMO_USERNAME: "judge",
    DEMO_PASSWORD: "a-test-password-long-enough",
    RENDER_EXTERNAL_URL: "https://runway-test.onrender.com",
  };
  const app = createRuntime(db, { env }),
    server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = {
    authorization:
      "Basic " + Buffer.from("judge:" + env.DEMO_PASSWORD).toString("base64"),
    "content-type": "application/json",
  };
  try {
    assert.equal((await fetch(base + "/api/health")).status, 200);
    assert.equal((await fetch(base + "/api/plan")).status, 401);
    assert.equal((await fetch(base + "/api/plan", { headers })).status, 200);
    const body = JSON.stringify({
      date: "2026-11-10",
      description: "Hosted test",
      amount: 100,
      bucket: "everyday",
    });
    assert.equal(
      (
        await fetch(base + "/api/expenses", {
          method: "POST",
          headers: { ...headers, origin: env.RENDER_EXTERNAL_URL },
          body,
        })
      ).status,
      201,
    );
    assert.equal(
      (
        await fetch(base + "/api/expenses", {
          method: "POST",
          headers: { ...headers, origin: "https://evil.example" },
          body,
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(base + "/api/expenses", {
          method: "POST",
          headers: { ...headers, origin: "http://localhost:5173" },
          body,
        })
      ).status,
      403,
    );
    const status = await fetch(base + "/api/integrations/status", {
      headers,
    }).then((r) => r.json());
    assert.deepEqual(status, {
      paypalConfigured: false,
      aiConfigured: false,
      paypalLastSync: null,
    });
    assert.equal((await fetch(base + "/api/missing", { headers })).status, 404);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});
