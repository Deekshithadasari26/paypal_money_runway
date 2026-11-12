import { z } from "zod";
import { randomUUID, createHash } from "node:crypto";
import { oauth, configured } from "./paypal.js";
const invoiceConfigured = (env) =>
  configured(env) && z.email().safeParse(env.PAYPAL_INVOICER_EMAIL).success;
const draftSchema = z
  .object({
    customer: z.email(),
    description: z.string().trim().min(5).max(200),
    amount: z.number().int().positive().max(100000000),
    completed: z.literal(true),
  })
  .strict();
export function invoiceRoutes(
  app,
  db,
  { env = process.env, fetcher = fetch } = {},
) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS invoice_actions(id TEXT PRIMARY KEY,fingerprint TEXT UNIQUE NOT NULL,payload TEXT NOT NULL,state TEXT NOT NULL,invoice_id TEXT,created_at TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE)",
  );
  app.get("/api/invoice/status", (req, res) =>
    res.json({
      configured: invoiceConfigured(env),
      actions: db
        .prepare(
          "SELECT id,state,invoice_id,created_at FROM invoice_actions ORDER BY created_at DESC",
        )
        .all(),
    }),
  );
  app.post("/api/invoice/review", (req, res) => {
    const v = draftSchema.parse(req.body);
    const fingerprint = createHash("sha256")
      .update(
        JSON.stringify({
          ...v,
          merchant: env.PAYPAL_INVOICER_EMAIL || "unconfigured",
        }),
      )
      .digest("hex");
    const old = db
      .prepare("SELECT * FROM invoice_actions WHERE fingerprint=?")
      .get(fingerprint);
    if (old)
      return res.json({
        id: old.id,
        state: old.state,
        invoice_id: old.invoice_id,
        invoice: JSON.parse(old.payload),
      });
    const id = randomUUID();
    const invoice = {
      detail: {
        currency_code: "USD",
        note: "Sandbox test invoice for completed work. Draft only.",
      },
      invoicer: {
        email_address:
          env.PAYPAL_INVOICER_EMAIL || "YOUR_SANDBOX_BUSINESS_EMAIL",
      },
      primary_recipients: [{ billing_info: { email_address: v.customer } }],
      items: [
        {
          name: v.description,
          quantity: "1",
          unit_amount: {
            currency_code: "USD",
            value: (v.amount / 100).toFixed(2),
          },
        },
      ],
    };
    db.prepare(
      "INSERT INTO invoice_actions VALUES(?,?,?,'reviewed',NULL,?,?)",
    ).run(
      id,
      fingerprint,
      JSON.stringify(invoice),
      new Date().toISOString(),
      randomUUID(),
    );
    res.json({ id, state: "reviewed", invoice });
  });
  app.post("/api/invoice/:id/approve", async (req, res) => {
    z.object({ approved: z.literal(true) }).parse(req.body);
    const action = db
      .prepare("SELECT * FROM invoice_actions WHERE id=?")
      .get(req.params.id);
    if (!action)
      return res.status(404).json({ error: "Review this invoice first" });
    if (action.state === "created")
      return res.json({ invoice_id: action.invoice_id, alreadyCreated: true });
    if (action.state !== "reviewed")
      return res.status(409).json({
        error:
          "Creation is in progress or the outcome is uncertain. Check Sandbox invoicing before taking further action; automatic retry is blocked to prevent duplicates.",
      });
    if (!invoiceConfigured(env))
      return res.status(503).json({
        error:
          "Add Sandbox client credentials and PAYPAL_INVOICER_EMAIL to backend .env, then review again.",
      });
    const claim = db
      .prepare(
        "UPDATE invoice_actions SET state='authorizing' WHERE id=? AND state='reviewed'",
      )
      .run(action.id);
    if (!claim.changes)
      return res.status(409).json({ error: "Already processing" });
    let token;
    try {
      token = await oauth(env, fetcher);
    } catch (e) {
      db.prepare("UPDATE invoice_actions SET state='reviewed' WHERE id=?").run(
        action.id,
      );
      throw e;
    }
    // After the POST starts, an uncertain network result must never trigger a new
    // creation. A durable request ID and local claim also guard concurrent retries.
    db.prepare("UPDATE invoice_actions SET state='creating' WHERE id=?").run(
      action.id,
    );
    try {
      const r = await fetcher(
        "https://api-m.sandbox.paypal.com/v2/invoicing/invoices",
        {
          method: "POST",
          headers: {
            Authorization: "Bearer " + token,
            "Content-Type": "application/json",
            "PayPal-Request-Id": action.request_id,
            Prefer: "return=representation",
          },
          body: action.payload,
          signal: AbortSignal.timeout(20000),
        },
      );
      if (!r.ok) {
        if (
          r.status >= 400 &&
          r.status < 500 &&
          r.status !== 408 &&
          r.status !== 409 &&
          r.status !== 429
        ) {
          db.prepare(
            "UPDATE invoice_actions SET state='reviewed' WHERE id=?",
          ).run(action.id);
          throw Object.assign(
            Error(
              "PayPal rejected this draft (" +
                r.status +
                "). Verify Sandbox merchant and recipient details.",
            ),
            { definitive: true, status: 502 },
          );
        }
        throw Error("Uncertain invoice creation result");
      }
      const d = await r.json();
      const self = d.links?.find((l) => l.rel === "self")?.href;
      const id =
        d.id ||
        d.invoice_id ||
        (self && new URL(self).pathname.split("/").pop());
      if (!/^INV2-[A-Z0-9-]+$/.test(id || ""))
        throw Error("Invoice ID missing from PayPal response");
      db.prepare(
        "UPDATE invoice_actions SET state='created',invoice_id=? WHERE id=?",
      ).run(id, action.id);
      res.json({ invoice_id: id, alreadyCreated: false });
    } catch (e) {
      if (e.definitive) throw e;
      db.prepare("UPDATE invoice_actions SET state='uncertain' WHERE id=?").run(
        action.id,
      );
      res.status(502).json({
        error:
          "PayPal creation outcome is uncertain. Automatic retry is blocked. Check your Sandbox invoicing dashboard to reconcile this request.",
        request_id: action.request_id,
      });
    }
  });
}
