import crypto from "node:crypto";

// Single admin account for the dashboard. Credentials and signing secret live in .env
// (and in Vercel → Project Settings → Environment Variables in production).
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) throw httpError(500, "AUTH_SECRET is missing or too short (min 32 chars)");
  return value;
}

const base64url = (input) => Buffer.from(input).toString("base64url");
const sign = (data) => crypto.createHmac("sha256", secret()).update(data).digest("base64url");

// Constant-time comparison that also works for strings of different lengths
function safeEqual(a, b) {
  const hash = (text) => crypto.createHash("sha256").update(String(text)).digest();
  return crypto.timingSafeEqual(hash(a), hash(b));
}

// Token format: base64url(JSON payload) + "." + HMAC signature
export function createToken(email) {
  const payload = base64url(JSON.stringify({ email, exp: Date.now() + TOKEN_TTL_MS }));
  return { token: `${payload}.${sign(payload)}`, expiresAt: Date.now() + TOKEN_TTL_MS };
}

function readToken(req) {
  const header = req.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const [payload, signature] = token.split(".");
  if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;

  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    return data.exp > Date.now() ? data : null;
  } catch {
    return null;
  }
}

export function checkCredentials(email, password) {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) throw httpError(500, "ADMIN_EMAIL / ADMIN_PASSWORD are not configured");

  // Evaluate both so a wrong email takes as long as a wrong password
  const emailOk = safeEqual(String(email || "").trim().toLowerCase(), adminEmail.trim().toLowerCase());
  const passwordOk = safeEqual(String(password || ""), adminPassword);
  return emailOk && passwordOk;
}

// Route guard: only the logged-in admin gets through
export function requireAdmin(req, res, next) {
  const admin = readToken(req);
  if (!admin) return next(httpError(401, "Please log in to continue"));
  req.admin = admin;
  next();
}

// Public list routes show hidden items only to the admin (?includeInactive=true)
export function adminOnlyIncludeInactive(req, res, next) {
  if (req.query.includeInactive === "true") return requireAdmin(req, res, next);
  next();
}
