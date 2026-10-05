import express from "express";
import {
  getPosts,
  getPost,
  createPost,
  updatePost,
  deletePost,
} from "../controllers/instagramController.js";
import { uploadInstagramMedia } from "../middleware/upload.js";
import { requireAdmin, adminOnlyIncludeInactive } from "../middleware/auth.js";

const router = express.Router();

router.get("/", adminOnlyIncludeInactive, getPosts);
router.post("/", requireAdmin, uploadInstagramMedia, createPost);

router.get("/:id", getPost);
router.patch("/:id", requireAdmin, uploadInstagramMedia, updatePost);
router.delete("/:id", requireAdmin, deletePost);

export default router;
