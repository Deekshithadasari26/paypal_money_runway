import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
const dir = mkdtempSync(join(tmpdir(), "runway-production-"));
const password = "isolated-production-smoke-password";
const env = {
  ...process.env,
  NODE_ENV: "production",
  HOST: "127.0.0.1",
  PORT: "0",
  DATABASE_PATH: join(dir, "demo.sqlite"),
  DEMO_SEED_DATE: "2026-11-10",
  DEMO_USERNAME: "judge",
  DEMO_PASSWORD: password,
  APP_ORIGIN: "https://smoke.example",
  RENDER_EXTERNAL_URL: "",
  PAYPAL_CLIENT_ID: "",
  PAYPAL_CLIENT_SECRET: "",
  PAYPAL_INVOICER_EMAIL: "",
  OPENAI_API_KEY: "",
  DOTENV_CONFIG_PATH: join(dir, "absent.env"),
};
let child;
async function boot() {
  child = spawn(process.execPath, ["server/index.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  const port = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(Error("Production startup timed out")),
      15000,
    );
    child.once("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.once("exit", (code) => {
      clearTimeout(timer);
      reject(Error("Production exited before readiness: " + code));
    });
    child.stdout.on("data", (chunk) => {
      output += chunk;
      const match = /listening on 127\.0\.0\.1:(\d+)/.exec(output);
      if (match) {
        clearTimeout(timer);
        resolve(Number(match[1]));
      }
    });
  });
  return "http://127.0.0.1:" + port;
}
async function stop() {
  if (child && child.exitCode === null) {
    const done = once(child, "exit");
    child.kill("SIGTERM");
    await done;
  }
}
const headers = {
  authorization: "Basic " + Buffer.from("judge:" + password).toString("base64"),
};
try {
  let url = await boot();
  assert.equal((await fetch(url + "/api/health")).status, 200);
  assert.equal((await fetch(url)).status, 401);
  const page = await fetch(url, { headers });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /PayPal Money Runway/);
  assert.equal(
    (await fetch(url + "/paypal-mark.svg", { headers })).status,
    200,
  );
  const before = await fetch(url + "/api/today", { headers }).then((r) =>
    r.json(),
  );
  assert.equal(before.left, 30000);
  const added = await fetch(url + "/api/expenses", {
    method: "POST",
    headers: {
      ...headers,
      "content-type": "application/json",
      origin: env.APP_ORIGIN,
    },
    body: JSON.stringify({
      date: "2026-11-10",
      description: "Production persistence smoke",
      amount: 11100,
      bucket: "everyday",
    }),
  });
  assert.equal(added.status, 201);
  await stop();
  url = await boot();
  const after = await fetch(url + "/api/today", { headers }).then((r) =>
    r.json(),
  );
  assert.equal(after.left, 18900);
  assert.equal(after.transactions.length, 4);
  assert.equal((await fetch(url + "/api/plan", { headers })).status, 200);
  console.log(
    "Production smoke passed: authenticated React build, HTTPS-origin writes, health check, SVG asset and SQLite persistence after full restart.",
  );
} finally {
  await stop();
  rmSync(dir, { recursive: true, force: true });
}
