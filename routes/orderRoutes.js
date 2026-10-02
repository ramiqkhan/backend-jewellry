import express from "express";
import {
  createOrder,
  getOrders,
  getOrderOptions,
  trackOrder,
  getOrder,
  updateOrderStatus,
} from "../controllers/orderController.js";

const router = express.Router();

// Static paths must come before /:idOrNumber
router.get("/options", getOrderOptions);
router.get("/track", trackOrder);

router.post("/", createOrder);
router.get("/", getOrders);

router.get("/:idOrNumber", getOrder);
router.patch("/:id/status", updateOrderStatus);

export default router;
