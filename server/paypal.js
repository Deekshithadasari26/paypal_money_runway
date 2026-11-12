import { createHash } from "node:crypto";
import { z } from "zod";
import { getSetting, setSetting, todayIST } from "./db.js";
import { dateSchema } from "./app.js";
const BASE = "https://api-m.sandbox.paypal.com";
export const configured = (env = process.env) =>
  !!(
    env.PAYPAL_CLIENT_ID &&
    env.PAYPAL_CLIENT_SECRET &&
    !/YOUR_|placeholder/i.test(env.PAYPAL_CLIENT_ID + env.PAYPAL_CLIENT_SECRET)
  );
export function decimalMinor(value, currency) {
  if (!/^[A-Z]{3}$/.test(currency)) throw Error("Invalid currency");
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(value));
  if (!match || (match[3] || "").slice(digits).replace(/0/g, "") !== "")
    throw Error("Invalid currency precision");
  const n =
    BigInt(match[2]) * 10n ** BigInt(digits) +
    BigInt((match[3] || "").slice(0, digits).padEnd(digits, "0") || "0");
  const signed = Number(match[1] ? -n : n);
  if (!Number.isSafeInteger(signed)) throw Error("Amount too large");
  return signed;
}
export async function oauth(env = process.env, fetcher = fetch) {
  if (!configured(env))
    throw Object.assign(
      Error(
        "Sandbox credentials missing. Add PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET to the backend .env. The local INR budget is ready to use.",
      ),
      { status: 503 },
    );
  const r = await fetcher(BASE + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(
          env.PAYPAL_CLIENT_ID + ":" + env.PAYPAL_CLIENT_SECRET,
        ).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(20000),
  });
  if (!r.ok)
    throw Object.assign(
      Error(
        `PayPal Sandbox OAuth failed (${r.status}). Check your sandbox credentials.`,
      ),
      { status: 502 },
    );
  const d = await r.json();
  if (!d.access_token) throw Error("PayPal did not return an access token");
  return d.access_token;
}
export function normalizePayPal(record, source = "PayPal Sandbox") {
  const t = record.transaction_info;
  if (!t?.transaction_id || !t.transaction_event_code || !t.transaction_amount)
    throw Error("Malformed PayPal transaction");
  const currency = t.transaction_amount.currency_code;
  const signed = decimalMinor(t.transaction_amount.value, currency);
  const opening = t.transaction_event_code === "T1900";
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(t.transaction_initiation_date));
  dateSchema.parse(date);
  return {
    key:
      (source === "PayPal sample" ? "paypal-sample:" : "paypal:") +
      createHash("sha256")
        .update(
          [t.transaction_id, t.transaction_event_code, currency].join("|"),
        )
        .digest("hex"),
    date,
    description: String(
      t.transaction_subject || t.transaction_event_code,
    ).slice(0, 200),
    amount: Math.abs(signed),
    currency,
    bucket: "paypal",
    kind: opening ? "opening" : signed < 0 ? "expense" : "income",
    source,
    event: t.transaction_event_code,
    status:
      t.transaction_status === "S"
        ? "posted"
        : t.transaction_status === "P"
          ? "pending"
          : "excluded",
  };
}
export function importPayPal(db, rows, source = "PayPal Sandbox") {
  const records = rows.map((r) => normalizePayPal(r, source));
  let imported = 0;
  db.exec("BEGIN IMMEDIATE");
  try {
    for (const r of records) {
      const existing = db
        .prepare("SELECT id FROM transactions WHERE external_key=?")
        .get(r.key);
      db.prepare(
        "INSERT INTO transactions(external_key,date,description,amount,currency,bucket,kind,source,event_code,status) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(external_key) DO UPDATE SET description=excluded.description,amount=excluded.amount,status=excluded.status",
      ).run(
        r.key,
        r.date,
        r.description,
        r.amount,
        r.currency,
        r.bucket,
        r.kind,
        r.source,
        r.event,
        r.status,
      );
      if (!existing) imported++;
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return { imported, duplicates: rows.length - imported };
}
export async function syncPayPal(
  db,
  { start, end },
  env = process.env,
  fetcher = fetch,
) {
  if (!start || !end) throw Error("Choose a sync window");
  const startDate = new Date(start),
    endDate = new Date(end);
  if (
    isNaN(+startDate) ||
    isNaN(+endDate) ||
    endDate < startDate ||
    endDate - startDate > 31 * 86400000 ||
    endDate > Date.now() + 60000
  )
    throw Error("Choose a past window of at most 31 days");
  const token = await oauth(env, fetcher);
  const records = [];
  let pages = 1;
  for (let page = 1; page <= pages; page++) {
    const q = new URLSearchParams({
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
      fields: "all",
      page_size: "100",
      page: String(page),
      balance_affecting_records_only: "Y",
    });
    const r = await fetcher(BASE + "/v1/reporting/transactions?" + q, {
      headers: { Authorization: "Bearer " + token },
      signal: AbortSignal.timeout(20000),
    });
    if (!r.ok)
      throw Object.assign(
        Error(
          `PayPal Transaction Search failed (${r.status}). Check reporting permissions and date range; new activity may take up to 3 hours to appear.`,
        ),
        { status: 502 },
      );
    const d = await r.json();
    if (!Array.isArray(d.transaction_details))
      throw Error("Malformed PayPal response");
    pages = Number(d.total_pages || 1);
    if (!Number.isInteger(pages) || pages < 0 || pages > 1000)
      throw Error("PayPal page limit exceeded");
    records.push(...d.transaction_details);
  }
  const result = importPayPal(db, records);
  setSetting(db, "paypalSync", {
    at: new Date().toISOString(),
    start: startDate.toISOString(),
    end: endDate.toISOString(),
    pages,
  });
  return { ...result, pages };
}
export const samplePayPal = [
  {
    transaction_info: {
      transaction_id: "DEMO-INITIAL-BALANCE",
      transaction_event_code: "T1900",
      transaction_subject: "Initial balance",
      transaction_initiation_date: "2026-11-10T07:00:00Z",
      transaction_status: "S",
      transaction_amount: { currency_code: "USD", value: "5000.00" },
    },
  },
  {
    transaction_info: {
      transaction_id: "DEMO-PAYMENT",
      transaction_event_code: "T0006",
      transaction_subject: "Completed design work · sample",
      transaction_initiation_date: "2026-11-10T08:00:00Z",
      transaction_status: "S",
      transaction_amount: { currency_code: "USD", value: "120.00" },
    },
  },
];
export function paypalRoutes(
  app,
  db,
  { env = process.env, fetcher = fetch } = {},
) {
  app.get("/api/paypal", (req, res) =>
    res.json({
      configured: configured(env),
      status: configured(env)
        ? "Sandbox credentials configured"
        : "Sandbox credentials missing · local INR demo is ready",
      lastSync: getSetting(db, "paypalSync", null),
      transactions: db
        .prepare(
          "SELECT * FROM transactions WHERE source LIKE 'PayPal%' ORDER BY date DESC,id DESC",
        )
        .all(),
      settlements: db
        .prepare(
          "SELECT * FROM transactions WHERE currency='INR' AND source NOT LIKE 'PayPal%' AND kind IN ('expense','income') AND status='posted'",
        )
        .all(),
    }),
  );
  let syncing = false;
  app.post("/api/paypal/sync", async (req, res) => {
    if (syncing)
      return res.status(409).json({ error: "A sync is already running" });
    syncing = true;
    try {
      const v = z
        .object({ start: z.string(), end: z.string() })
        .parse(req.body);
      res.json(await syncPayPal(db, v, env, fetcher));
    } finally {
      syncing = false;
    }
  });
  app.post("/api/paypal/sample", (req, res) =>
    res.json(importPayPal(db, samplePayPal, "PayPal sample")),
  );
  app.post("/api/paypal/match", (req, res) => {
    const v = z
      .object({ paypal_id: z.number().int(), settlement_id: z.number().int() })
      .parse(req.body);
    const p = db
      .prepare(
        "SELECT * FROM transactions WHERE id=? AND source LIKE 'PayPal%' AND kind!='opening' AND status='posted'",
      )
      .get(v.paypal_id);
    const s = db
      .prepare(
        "SELECT * FROM transactions WHERE id=? AND currency='INR' AND source NOT LIKE 'PayPal%' AND status='posted'",
      )
      .get(v.settlement_id);
    if (!p || !s || s.kind !== p.kind)
      throw Error(
        "Select a posted payment and an INR settlement in the same direction",
      );
    db.prepare("UPDATE transactions SET matched_id=? WHERE id=?").run(
      s.id,
      p.id,
    );
    res.json({ ok: true });
  });
  app.post("/api/paypal/settlement", (req, res) => {
    const v = z
      .object({
        paypal_id: z.number().int(),
        date: dateSchema,
        amount: z.number().int().positive().max(1e10),
        bucket: z.enum([
          "everyday",
          "fun",
          "bills",
          "subscriptions",
          "sip",
          "debt",
        ]),
      })
      .parse(req.body);
    const p = db
      .prepare(
        "SELECT * FROM transactions WHERE id=? AND source LIKE 'PayPal%' AND kind!='opening' AND status='posted'",
      )
      .get(v.paypal_id);
    if (!p) throw Error("Posted PayPal payment not found");
    if (p.matched_id)
      return res.json({ ok: true, id: p.matched_id, alreadyMatched: true });
    db.exec("BEGIN");
    try {
      const key = "settlement:" + p.id;
      const r = db
        .prepare(
          "INSERT INTO transactions(external_key,date,description,amount,bucket,kind,source) VALUES(?,?,?,?,?,?,'INR settlement')",
        )
        .run(
          key,
          v.date,
          "Recorded INR settlement",
          v.amount,
          v.bucket,
          p.kind,
        );
      db.prepare("UPDATE transactions SET matched_id=? WHERE id=?").run(
        r.lastInsertRowid,
        p.id,
      );
      db.exec("COMMIT");
      res.json({ ok: true, id: Number(r.lastInsertRowid) });
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  });
}
