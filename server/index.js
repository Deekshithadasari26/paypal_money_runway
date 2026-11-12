import "dotenv/config";
import { openDb, seed, setSetting, getSetting } from "./db.js";
import { seedPlanner } from "./planner.js";
import { createRuntime } from "./runtime.js";
import { dateSchema } from "./app.js";
const db = openDb();
// A reproducible judging seed is optional. Existing databases are never reset.
const demoDate = process.env.DEMO_SEED_DATE;
if (demoDate) dateSchema.parse(demoDate);
const fresh = !getSetting(db, "seeded", false);
seed(db, demoDate);
seedPlanner(db, demoDate);
if (fresh && demoDate) setSetting(db, "demoDate", demoDate);
const app = createRuntime(db);
const host =
  process.env.HOST ||
  (process.env.RENDER || process.env.NODE_ENV === "production"
    ? "0.0.0.0"
    : "127.0.0.1");
const server = app.listen(Number(process.env.PORT || 3001), host, () =>
  console.log(`Money Runway listening on ${host}:${server.address().port}`),
);
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? "Port already in use. Stop the older backend or choose another PORT."
      : "Server could not start.",
  );
  db.close();
  process.exitCode = 1;
});
let closing = false;
function shutdown() {
  if (closing) return;
  closing = true;
  server.close(() => {
    db.close();
    process.exitCode = 0;
  });
  setTimeout(() => process.exit(1), 25000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
