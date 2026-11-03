import express from "express";
import { getDeals, getDeal, createDeal, updateDeal, deleteDeal } from "../controllers/dealController.js";
import { uploadDealBanner } from "../middleware/upload.js";
import { requireAdmin, adminOnlyIncludeInactive } from "../middleware/auth.js";

const router = express.Router();

router.get("/", adminOnlyIncludeInactive, getDeals);
router.post("/", requireAdmin, uploadDealBanner, createDeal);

router.get("/:idOrSlug", getDeal);
router.patch("/:id", requireAdmin, uploadDealBanner, updateDeal);
router.delete("/:id", requireAdmin, deleteDeal);

export default router;
