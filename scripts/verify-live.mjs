import "dotenv/config";
import { once } from "node:events";
import { openDb, seed } from "../server/db.js";
import { seedPlanner } from "../server/planner.js";
import { createRuntime } from "../server/runtime.js";
const db = openDb();
seed(db);
seedPlanner(db);
// Exercise the same HTTP routes as the app, on an ephemeral loopback port.
const app = createRuntime(db),
  server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const base = `http://127.0.0.1:${server.address().port}`;
const headers = { "content-type": "application/json" };
if (process.env.DEMO_PASSWORD)
  headers.authorization =
    "Basic " +
    Buffer.from(
      (process.env.DEMO_USERNAME || "judge") + ":" + process.env.DEMO_PASSWORD,
    ).toString("base64");
const post = async (path, body) => {
  const response = await fetch(base + path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });
  const data = await response.json();
  if (!response.ok)
    throw Error(data.error || "Backend verification request failed");
  return data;
};
const report = {
  checkedAt: new Date().toISOString(),
  through: "app HTTP routes",
  paypal: { status: "not-configured" },
  ai: { status: "not-configured" },
};
try {
  const config = await fetch(base + "/api/integrations/status", {
    headers,
  }).then((r) => r.json());
  if (config.paypalConfigured) {
    const now = Date.now(),
      window = {
        start: new Date(now - 30 * 86400000).toISOString(),
        end: new Date(now - 60000).toISOString(),
      };
    try {
      const first = await post("/api/paypal/sync", window),
        second = await post("/api/paypal/sync", window);
      report.paypal = {
        status: "verified",
        ...first,
        repeatImported: second.imported,
        repeatDuplicates: second.duplicates,
        window,
      };
      if (second.imported !== 0)
        report.paypal.note =
          "Additional records became available between requests. Inspect IDs to distinguish late arrivals from duplicates.";
    } catch (error) {
      report.paypal = { status: "failed", message: error.message };
      process.exitCode = 1;
    }
  }
  if (config.aiConfigured) {
    const result = await post("/api/insights", {});
    report.ai = {
      status: result.mode === "model" ? "verified" : "fallback",
      mode: result.mode,
      message: result.status,
    };
    if (result.mode !== "model") process.exitCode = 1;
  }
  // Counts/status only; no tokens, credentials, transaction details or AI facts.
  console.log(JSON.stringify(report, null, 2));
} finally {
  await new Promise((r) => server.close(r));
  db.close();
}
