import express from "express";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp, errors } from "./app.js";
import { getSetting } from "./db.js";
import { plannerRoutes } from "./planner.js";
import { paypalRoutes, configured } from "./paypal.js";
import { forecastRoutes, aiConfiguration } from "./forecast.js";
import { calendarRoutes } from "./calendar.js";
import { invoiceRoutes } from "./invoice.js";
const root = fileURLToPath(new URL("../", import.meta.url));
export function createRuntime(db, { env = process.env, fetcher = fetch } = {}) {
  const app = createApp(db, { env });
  plannerRoutes(app, db);
  paypalRoutes(app, db, { env, fetcher });
  forecastRoutes(app, db, { env, fetcher });
  calendarRoutes(app, db);
  invoiceRoutes(app, db, { env, fetcher });
  app.get("/api/integrations/status", (req, res) =>
    res.json({
      paypalConfigured: configured(env),
      aiConfigured: aiConfiguration(env).configured,
      paypalLastSync: getSetting(db, "paypalSync", null),
    }),
  );
  errors(app);
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API route not found" }),
  );
  app.use(express.static(resolve(root, "dist"), { index: false }));
  app.get("/{*path}", (req, res) =>
    res.sendFile(resolve(root, "dist/index.html")),
  );
  return app;
}
