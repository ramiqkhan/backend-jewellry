import "dotenv/config";

import express from "express";
import cors from "cors";
import multer from "multer";
import { connectDB } from "./config/db.js";
import { configureCloudinary } from "./config/cloudinary.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import reviewRoutes from "./routes/reviewRoutes.js";
import instagramRoutes from "./routes/instagramRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { getShowcase } from "./controllers/showcaseController.js";

configureCloudinary();

const app = express();

// Vercel sits in front of the app as a proxy; this makes req.ip the visitor's real IP
// (the login rate limit in routes/authRoutes.js depends on it)
app.set("trust proxy", 1);

// CORS_ORIGINS=https://store.example.com,https://admin.example.com  (empty = allow all)
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);
app.use(cors(allowedOrigins.length ? { origin: allowedOrigins } : {}));
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Zelora API is running" });
});

// Connect (or reuse the open connection) before any API route touches the database
app.use("/api", async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch {
    res.status(503).json({ success: false, message: "Database unavailable, please try again shortly" });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/instagram", instagramRoutes);
app.get("/api/showcase", getShowcase);

// 404 for unknown routes
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Central error handler
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Server error";

  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  } else if (err.code === 11000) {
    statusCode = 409;
    message = `Duplicate value for: ${Object.keys(err.keyValue).join(", ")}`;
  } else if (err instanceof multer.MulterError) {
    statusCode = 400;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "File is too large (images up to 5MB, videos up to 50MB)"
        : err.message;
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  if (statusCode === 500) console.error(err);
  res.status(statusCode).json({ success: false, message });
});

// On Vercel the exported app is the request handler. Locally, start a normal server.
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  connectDB()
    .then(() => app.listen(PORT, () => console.log(`Server running on port ${PORT}`)))
    .catch(() => process.exit(1));
}

export default app;
