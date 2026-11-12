import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, seed, daily } from "../server/db.js";
test("SQLite data survives closing and reopening the database", () => {
  const dir = mkdtempSync(join(tmpdir(), "runway-"));
  const path = join(dir, "test.sqlite");
  let db = openDb(path);
  seed(db, "2026-11-10");
  db.prepare("UPDATE transactions SET amount=30000 WHERE id=1").run();
  db.close();
  db = openDb(path);
  assert.equal(daily(db, "2026-11-10").left, 25000);
  db.close();
  rmSync(dir, { recursive: true });
});
