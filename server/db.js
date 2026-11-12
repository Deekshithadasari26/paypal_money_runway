import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export function openDb(
  path = process.env.DATABASE_PATH || "./data/money-runway.sqlite",
) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY,external_key TEXT UNIQUE,date TEXT NOT NULL,description TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL DEFAULT 'INR',bucket TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'expense',source TEXT NOT NULL,commitment_id INTEGER,plan_date TEXT,matched_id INTEGER UNIQUE,event_code TEXT,status TEXT NOT NULL DEFAULT 'posted');
 CREATE TABLE IF NOT EXISTS commitments(id INTEGER PRIMARY KEY,name TEXT NOT NULL,amount INTEGER NOT NULL,day INTEGER NOT NULL,bucket TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS recaps(date TEXT PRIMARY KEY,body TEXT NOT NULL);
 `);
  return db;
}
export const getSetting = (db, key, fallback) => {
  const r = db.prepare("SELECT value FROM settings WHERE key=?").get(key);
  return r ? JSON.parse(r.value) : fallback;
};
export const setSetting = (db, key, value) =>
  db
    .prepare(
      "INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(key, JSON.stringify(value));
export const todayIST = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export function seed(db, date = todayIST()) {
  if (getSetting(db, "seeded", false)) return;
  setSetting(db, "seeded", true);
  setSetting(db, "allowance", 80000);
  for (const [description, amount] of [
    ["Lunch at the office", 25000],
    ["Office travel", 15000],
    ["Afternoon coffee", 10000],
  ])
    db.prepare(
      "INSERT INTO transactions(date,description,amount,bucket,source) VALUES(?,?,?,?,?)",
    ).run(date, description, amount, "everyday", "Demo seed");
}
export function daily(db, date) {
  const transactions = db
    .prepare(
      "SELECT * FROM transactions WHERE date=? AND currency='INR' AND source NOT LIKE 'PayPal%' AND status='posted' ORDER BY id DESC",
    )
    .all(date);
  const spent = transactions
    .filter(
      (t) =>
        t.currency === "INR" &&
        t.bucket === "everyday" &&
        t.kind === "expense" &&
        t.status === "posted" &&
        !t.source.startsWith("PayPal"),
    )
    .reduce((s, t) => s + t.amount, 0);
  const allowance = getSetting(db, "allowance", 80000);
  return {
    date,
    allowance,
    spent,
    left: allowance - spent,
    fun: transactions
      .filter(
        (t) =>
          t.bucket === "fun" &&
          t.kind === "expense" &&
          t.currency === "INR" &&
          !t.source.startsWith("PayPal"),
      )
      .reduce((s, t) => s + t.amount, 0),
    transactions,
  };
}
