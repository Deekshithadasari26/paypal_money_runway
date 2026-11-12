import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import express from "express";
const digest = (value) => createHash("sha256").update(String(value)).digest();
export function configureAccess(app, db, env = process.env) {
  const production = env.NODE_ENV === "production";
  const publicDemo =
    env.TEMPORARY_DEMO === "true" && env.PUBLIC_DEMO !== "false";
  if (
    production &&
    !publicDemo &&
    (!env.DEMO_PASSWORD ||
      env.DEMO_PASSWORD.length < 16 ||
      /YOUR_|placeholder/i.test(env.DEMO_PASSWORD))
  )
    throw Error(
      "Production requires a DEMO_PASSWORD of at least 16 characters. Set it in the hosting environment.",
    );
  app.disable("x-powered-by");
  if (production) app.set("trust proxy", 1);
  app.use((req, res, next) => {
    res.set({
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "same-origin",
    });
    next();
  });
  // Render's health check discloses no account, balance, or credential data.
  app.get("/api/health", (req, res) => {
    db.prepare("SELECT 1").get();
    res.json({ status: "ok", app: "Money Runway" });
  });
  if (env.DEMO_PASSWORD && !publicDemo) {
    const same = (a, b) => timingSafeEqual(digest(a), digest(b));
    const sign = (value) =>
      createHmac("sha256", env.DEMO_PASSWORD).update(value).digest("base64url");
    const allowed = [env.APP_ORIGIN, env.RENDER_EXTERNAL_URL]
      .filter(Boolean)
      .map((v) => new URL(v).origin);
    const validOrigin = (req) =>
      !req.headers.origin ||
      allowed.includes(req.headers.origin) ||
      (!production &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.origin));
    const page = (error = false) =>
      `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign in · Money Runway</title><style>body{margin:0;background:#f5f8fc;color:#142c5c;font:18px Arial,sans-serif;display:grid;place-items:center;min-height:100vh}main{background:white;padding:40px;border:1px solid #ccdbee;border-radius:20px;width:min(380px,80vw)}h1{color:#003087}label{display:block;margin:22px 0}input{box-sizing:border-box;display:block;width:100%;padding:14px;margin-top:8px;border:1px solid #a9bfd8;border-radius:8px;font:inherit}button{width:100%;padding:15px;background:#003087;color:white;border:0;border-radius:8px;font:inherit}p{line-height:1.5}small{color:#365477}</style></head><body><main><h1>Money Runway</h1><p>Sign in to the judge demo.</p>${error ? '<p role="alert">The username or password was not accepted. Try again.</p>' : ""}<form method="post" action="/login"><label>Username<input name="username" autocomplete="username" value="judge" required></label><label>Demo password<input name="password" type="password" autocomplete="current-password" required></label><button>Sign in</button></form><p><small>Use the judge credentials supplied with the project. This is not your PayPal or Render login.</small></p></main></body></html>`;
    app.get("/login", (req, res) => res.type("html").send(page()));
    app.post(
      "/login",
      express.urlencoded({ extended: false, limit: "4kb" }),
      (req, res) => {
        if (!validOrigin(req))
          return res.status(403).send("Request origin is not allowed");
        if (
          !same(req.body?.username || "", env.DEMO_USERNAME || "judge") ||
          !same(req.body?.password || "", env.DEMO_PASSWORD)
        )
          return res.status(401).type("html").send(page(true));
        const token = `${Date.now() + 8 * 60 * 60 * 1000}.${randomBytes(24).toString("base64url")}`;
        res.cookie("runway_session", token + "." + sign(token), {
          httpOnly: true,
          secure: production,
          sameSite: "strict",
          path: "/",
          maxAge: 8 * 60 * 60 * 1000,
        });
        res.redirect(303, "/");
      },
    );
    app.use((req, res, next) => {
      const cookie =
        (req.headers.cookie || "")
          .split(";")
          .map((v) => v.trim())
          .find((v) => v.startsWith("runway_session="))
          ?.slice(15) || "";
      const parts = cookie.split(".");
      if (
        cookie.length < 200 &&
        parts.length === 3 &&
        Number(parts[0]) > Date.now() &&
        same(parts[2], sign(parts.slice(0, 2).join(".")))
      )
        return next();
      const auth = req.headers.authorization || "";
      const decoded = auth.startsWith("Basic ")
        ? Buffer.from(auth.slice(6), "base64").toString("utf8")
        : "";
      const split = decoded.indexOf(":");
      if (
        split >= 0 &&
        same(decoded.slice(0, split), env.DEMO_USERNAME || "judge") &&
        same(decoded.slice(split + 1), env.DEMO_PASSWORD)
      )
        return next();
      if (!req.path.startsWith("/api/")) return res.redirect(302, "/login");
      res.status(401).json({ error: "Judge demo sign-in required" });
    });
  }
  const configuredOrigins = [env.APP_ORIGIN, env.RENDER_EXTERNAL_URL]
    .filter(Boolean)
    .map((value) => new URL(value).origin);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && origin) {
      const local =
        !production &&
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (!local && !configuredOrigins.includes(origin))
        return res.status(403).json({ error: "Request origin is not allowed" });
    }
    next();
  });
}
