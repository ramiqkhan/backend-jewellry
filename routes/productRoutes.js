import express from "express";
import {
  getProducts,
  searchProducts,
  getSearchSuggestions,
  getMenu,
  getProductsByMenu,
  getOptions,
  getProductBySku,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
} from "../controllers/productController.js";
import { uploadProductImages } from "../middleware/upload.js";
import { requireAdmin, adminOnlyIncludeInactive } from "../middleware/auth.js";

const router = express.Router();

// Static paths must come before /:idOrSlug
router.get("/search", searchProducts);
router.get("/search/suggestions", getSearchSuggestions);
router.get("/menu", getMenu);
router.get("/menu/:menuSlug", getProductsByMenu);
router.get("/options", getOptions);
router.get("/sku/:sku", getProductBySku);

router.get("/", adminOnlyIncludeInactive, getProducts);
router.post("/", requireAdmin, uploadProductImages, createProduct);

router.get("/:idOrSlug", getProduct);
router.patch("/:id", requireAdmin, uploadProductImages, updateProduct);
router.delete("/:id", requireAdmin, deleteProduct);

export default router;
