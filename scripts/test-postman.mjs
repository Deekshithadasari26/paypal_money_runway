import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { spawn } from "node:child_process";
import { openDb, seed, setSetting } from "../server/db.js";
import { seedPlanner } from "../server/planner.js";
import { createRuntime } from "../server/runtime.js";
const dir = mkdtempSync(join(tmpdir(), "runway-postman-"));
const db = openDb(join(dir, "demo.sqlite"));
seed(db, "2026-11-10");
seedPlanner(db, "2026-11-10");
setSetting(db, "demoDate", "2026-11-10");
// No dotenv import and explicit empty integration env: no private API calls.
const app = createRuntime(db, { env: {} }),
  server = app.listen(0, "127.0.0.1");
await once(server, "listening");
const environment = JSON.parse(
  readFileSync("postman/Local.postman_environment.json"),
);
const overrides = {
  baseUrl: `http://127.0.0.1:${server.address().port}`,
  runMutations: "true",
  expectSeed: "true",
};
for (const v of environment.values)
  if (v.key in overrides) v.value = overrides[v.key];
const environmentPath = join(dir, "isolated.postman_environment.json");
writeFileSync(environmentPath, JSON.stringify(environment));
try {
  // The optional development-only runner stays outside this app's dependency
  // tree and deployed bundle. It executes only our checked-in collection.
  const runner = spawn(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "--yes",
      "--package=newman@6.2.3",
      "--",
      "newman",
      "run",
      "postman/Money-Runway.postman_collection.json",
      "--environment",
      environmentPath,
      "--timeout-request",
      "10000",
    ],
    { stdio: "inherit" },
  );
  const code = await new Promise((resolve, reject) => {
    runner.once("error", reject);
    runner.once("exit", resolve);
  });
  if (code !== 0) process.exitCode = 1;
} finally {
  await new Promise((r) => server.close(r));
  db.close();
  rmSync(dir, { recursive: true, force: true });
}
