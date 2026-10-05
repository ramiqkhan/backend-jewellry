import express from "express";
import { checkCredentials, createToken, requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Basic brute-force protection: 5 failed logins per IP per 15 minutes.
// In-memory, so on Vercel it's per instance — a speed bump, not a guarantee.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map(); // ip -> { count, resetAt }

function tooManyAttempts(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt < Date.now()) return false;
  return entry.count >= MAX_FAILURES;
}

function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.resetAt < Date.now()) failures.set(ip, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else entry.count += 1;
}

// POST /api/auth/login  (JSON: email, password)
router.post("/login", (req, res) => {
  const ip = req.ip;
  if (tooManyAttempts(ip)) {
    return res.status(429).json({ success: false, message: "Too many failed attempts. Try again in 15 minutes." });
  }

  const { email, password } = req.body || {};
  if (!checkCredentials(email, password)) {
    recordFailure(ip);
    return res.status(401).json({ success: false, message: "Incorrect email or password" });
  }

  failures.delete(ip);
  const adminEmail = String(email).trim().toLowerCase();
  res.json({ success: true, ...createToken(adminEmail), email: adminEmail });
});

// GET /api/auth/me — lets the dashboard check a saved token is still valid
router.get("/me", requireAdmin, (req, res) => {
  res.json({ success: true, email: req.admin.email });
});

export default router;
