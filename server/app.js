import express from "express";
import { configureAccess } from "./security.js";
import { parse } from "csv-parse/sync";
import { createHash } from "node:crypto";
import { z } from "zod";
import { daily, getSetting, setSetting, todayIST } from "./db.js";
const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) =>
      !isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s,
    "Invalid calendar date",
  );
const expenseSchema = z.object({
  date: dateSchema,
  description: z.string().trim().min(1).max(200),
  amount: z.number().int().positive().max(10000000000),
  bucket: z.enum(["everyday", "fun", "bills", "subscriptions", "sip", "debt"]),
});
export function createApp(db, { env = process.env } = {}) {
  const app = express();
  configureAccess(app, db, env);
  app.use(express.json({ limit: "256kb" }));
  app.get("/api/today", (req, res) =>
    res.json(
      daily(
        db,
        dateSchema.parse(
          req.query.date || getSetting(db, "demoDate", todayIST()),
        ),
      ),
    ),
  );
  app.post("/api/expenses", (req, res) => {
    const e = expenseSchema.parse(req.body);
    const r = db
      .prepare(
        "INSERT INTO transactions(date,description,amount,bucket,source,commitment_id,plan_date) VALUES(?,?,?,?,?,?,?)",
      )
      .run(
        e.date,
        e.description,
        e.amount,
        e.bucket,
        "Manual",
        e.commitment_id ?? null,
        e.plan_date ?? null,
      );
    res.status(201).json({ id: Number(r.lastInsertRowid) });
  });
  app.put("/api/expenses/:id", (req, res) => {
    const e = expenseSchema.parse(req.body);
    const r = db
      .prepare(
        "UPDATE transactions SET date=?,description=?,amount=?,bucket=? WHERE id=? AND kind='expense' AND source NOT LIKE 'PayPal%'",
      )
      .run(e.date, e.description, e.amount, e.bucket, Number(req.params.id));
    if (!r.changes)
      return res.status(404).json({ error: "Editable expense not found" });
    res.json({ ok: true });
  });
  app.post("/api/import-csv", (req, res) => {
    const rows = parse(req.body.csv, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    if (rows.length > 1000) throw Error("Maximum 1000 rows");
    const parsed = rows.map((r) => {
      if (r.currency !== "INR") throw Error("Sample bank CSV accepts INR only");
      if (!/^\d+(\.\d{1,2})?$/.test(r.amount))
        throw Error("Invalid decimal amount");
      return {
        ...expenseSchema.parse({
          ...r,
          amount: Math.round(Number(r.amount) * 100),
        }),
        key:
          "csv:" +
          createHash("sha256")
            .update(
              [
                r.id || "",
                r.date,
                r.description,
                r.amount,
                r.currency,
                r.bucket,
              ].join("|"),
            )
            .digest("hex"),
      };
    });
    let imported = 0;
    db.exec("BEGIN");
    try {
      for (const r of parsed)
        imported += Number(
          db
            .prepare(
              "INSERT OR IGNORE INTO transactions(external_key,date,description,amount,bucket,source) VALUES(?,?,?,?,?,?)",
            )
            .run(
              r.key,
              r.date,
              r.description,
              r.amount,
              r.bucket,
              "Sample INR CSV",
            ).changes,
        );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    res.json({ imported, duplicates: rows.length - imported });
  });
  app.post("/api/recap", (req, res) => {
    const d = daily(db, dateSchema.parse(req.body.date));
    const body = `Everyday: ₹${(d.spent / 100).toFixed(2)} spent of ₹${d.allowance / 100}. ${d.left < 0 ? "Overspent by" : "Left"} ₹${Math.abs(d.left) / 100}. Fun: ₹${d.fun / 100}.`;
    db.prepare(
      "INSERT INTO recaps VALUES(?,?) ON CONFLICT(date) DO UPDATE SET body=excluded.body",
    ).run(d.date, body);
    res.json({ body });
  });
  app.get("/api/recaps", (req, res) =>
    res.json(
      db.prepare("SELECT * FROM recaps ORDER BY date DESC LIMIT 30").all(),
    ),
  );
  app.locals.db = db;
  return app;
}
export function errors(app) {
  app.use((err, req, res, next) => {
    res.status(err instanceof z.ZodError ? 400 : err.status || 400).json({
      error:
        err instanceof z.ZodError
          ? err.issues.map((i) => i.message).join("; ")
          : err.message || "Request failed",
    });
  });
}
export { dateSchema };
