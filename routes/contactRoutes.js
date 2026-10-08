import express from "express";
import {
  createMessage,
  getContactOptions,
  getMessages,
  getMessage,
  updateMessage,
  deleteMessage,
} from "../controllers/contactController.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Basic spam protection for the public form: 5 messages per IP per hour.
// In-memory, so on Vercel it's per instance — a speed bump, not a guarantee.
const WINDOW_MS = 60 * 60 * 1000;
const MAX_MESSAGES = 5;
const sent = new Map(); // ip -> { count, resetAt }

function limitSubmissions(req, res, next) {
  const now = Date.now();
  const entry = sent.get(req.ip);
  if (entry && entry.resetAt > now && entry.count >= MAX_MESSAGES) {
    return res
      .status(429)
      .json({ success: false, message: "You've sent several messages already. Please try again later." });
  }
  if (!entry || entry.resetAt <= now) sent.set(req.ip, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
  next();
}

// Bots fill every field; real visitors never see the hidden "website" field.
// Pretend it worked so the bot doesn't retry.
function honeypot(req, res, next) {
  if (req.body?.website) {
    return res.status(201).json({ success: true, message: "Thank you! We'll get back to you shortly." });
  }
  next();
}

// Static paths must come before /:id
router.get("/options", getContactOptions);

router.post("/", honeypot, limitSubmissions, createMessage);
router.get("/", requireAdmin, getMessages);

router.get("/:id", requireAdmin, getMessage);
router.patch("/:id", requireAdmin, updateMessage);
router.delete("/:id", requireAdmin, deleteMessage);

export default router;
