import express from "express";
import {
  createOrder,
  getOrders,
  getOrderOptions,
  trackOrder,
  getOrder,
  updateOrderStatus,
} from "../controllers/orderController.js";
import { requireAdmin } from "../middleware/auth.js";

const router = express.Router();

// Static paths must come before /:idOrNumber
router.get("/options", getOrderOptions);
router.get("/track", trackOrder);

router.post("/", createOrder);
router.get("/", requireAdmin, getOrders);

router.get("/:idOrNumber", requireAdmin, getOrder);
router.patch("/:id/status", requireAdmin, updateOrderStatus);

export default router;
