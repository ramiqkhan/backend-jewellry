import express from "express";
import {
  getReviews,
  getReview,
  createReview,
  updateReview,
  deleteReview,
} from "../controllers/reviewController.js";
import { uploadReviewImage } from "../middleware/upload.js";
import { requireAdmin, adminOnlyIncludeInactive } from "../middleware/auth.js";

const router = express.Router();

router.get("/", adminOnlyIncludeInactive, getReviews);
router.post("/", requireAdmin, uploadReviewImage, createReview);

router.get("/:id", getReview);
router.patch("/:id", requireAdmin, uploadReviewImage, updateReview);
router.delete("/:id", requireAdmin, deleteReview);

export default router;
