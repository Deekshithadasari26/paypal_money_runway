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

test("Judge form login issues a signed secure cookie; rejected and forged sessions stay protected", async () => {
  const db = openDb(":memory:");
  seed(db);
  seedPlanner(db);
  const env = {
    NODE_ENV: "production",
    DEMO_PASSWORD: "a-test-password-long-enough",
    RENDER_EXTERNAL_URL: "https://runway-test.onrender.com",
  };
  const server = createRuntime(db, { env }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const root = await fetch(base + "/", { redirect: "manual" });
    assert.equal(root.status, 302);
    assert.equal(root.headers.get("location"), "/login");
    assert.match(
      await fetch(base + "/login").then((r) => r.text()),
      /Demo password/,
    );
    const post = (password, origin = env.RENDER_EXTERNAL_URL) =>
      fetch(base + "/login", {
        method: "POST",
        redirect: "manual",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          origin,
        },
        body: new URLSearchParams({ username: "judge", password }),
      });
    assert.equal((await post("wrong")).status, 401);
    assert.equal(
      (await post(env.DEMO_PASSWORD, "https://evil.example")).status,
      403,
    );
    const login = await post(env.DEMO_PASSWORD);
    assert.equal(login.status, 303);
    const cookie = login.headers.get("set-cookie");
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /Secure/);
    assert.match(cookie, /SameSite=Strict/);
    assert.equal(
      (
        await fetch(base + "/api/today", {
          headers: { cookie: cookie.split(";")[0] },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await fetch(base + "/api/today", {
          headers: { cookie: "runway_session=9999999999999.forged.invalid" },
        })
      ).status,
      401,
    );
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});

test("Explicit temporary public demo opens without credentials; ordinary production stays protected", async () => {
  const db = openDb(":memory:");
  seed(db);
  seedPlanner(db);
  assert.throws(
    () =>
      createRuntime(db, {
        env: { NODE_ENV: "production", PUBLIC_DEMO: "true" },
      }),
    /DEMO_PASSWORD/,
  );
  const env = {
    NODE_ENV: "production",
    PUBLIC_DEMO: "true",
    TEMPORARY_DEMO: "true",
    DEMO_PASSWORD: "old-generated-password-long-enough",
  };
  const server = createRuntime(db, { env }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  try {
    const r = await fetch(
      `http://127.0.0.1:${server.address().port}/api/today`,
    );
    assert.equal(r.status, 200);
    assert.equal((await r.json()).left, 30000);
  } finally {
    await new Promise((r) => server.close(r));
    db.close();
  }
});
