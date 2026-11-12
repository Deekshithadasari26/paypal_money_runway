import { createHash, timingSafeEqual } from "node:crypto";
const digest = (value) => createHash("sha256").update(String(value)).digest();
export function configureAccess(app, db, env = process.env) {
  const production = env.NODE_ENV === "production";
  if (
    production &&
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
  if (env.DEMO_PASSWORD) {
    app.use((req, res, next) => {
      const auth = req.headers.authorization || "";
      const decoded = auth.startsWith("Basic ")
        ? Buffer.from(auth.slice(6), "base64").toString("utf8")
        : "";
      const split = decoded.indexOf(":");
      const username = split < 0 ? "" : decoded.slice(0, split),
        password = split < 0 ? "" : decoded.slice(split + 1);
      const validUser = timingSafeEqual(
        digest(username),
        digest(env.DEMO_USERNAME || "judge"),
      );
      const validPassword = timingSafeEqual(
        digest(password),
        digest(env.DEMO_PASSWORD),
      );
      if (validUser && validPassword) return next();
      res.set(
        "WWW-Authenticate",
        'Basic realm="Money Runway judge demo", charset="UTF-8"',
      );
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
