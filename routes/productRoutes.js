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

const router = express.Router();

// Static paths must come before /:idOrSlug
router.get("/search", searchProducts);
router.get("/search/suggestions", getSearchSuggestions);
router.get("/menu", getMenu);
router.get("/menu/:menuSlug", getProductsByMenu);
router.get("/options", getOptions);
router.get("/sku/:sku", getProductBySku);

router.get("/", getProducts);
router.post("/", uploadProductImages, createProduct);

router.get("/:idOrSlug", getProduct);
router.patch("/:id", uploadProductImages, updateProduct);
router.delete("/:id", deleteProduct);

export default router;
