import "dotenv/config";

import express from "express";
import cors from "cors";
import multer from "multer";
import { connectDB } from "./config/db.js";
import { configureCloudinary } from "./config/cloudinary.js";
import productRoutes from "./routes/productRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import dns from "node:dns/promises";

configureCloudinary();
dns.setServers(["8.8.8.8", "8.8.4.4"]);

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ success: true, message: "Zelora API is running" });
});

app.use("/api/products", productRoutes);
app.use("/api/orders", orderRoutes);

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
    message = err.code === "LIMIT_FILE_SIZE" ? "Each image must be 5MB or smaller" : err.message;
  } else if (err.name === "CastError") {
    statusCode = 400;
    message = `Invalid value for ${err.path}`;
  }

  if (statusCode === 500) console.error(err);
  res.status(statusCode).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});
