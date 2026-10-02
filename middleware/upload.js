import multer from "multer";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];

export const MAX_IMAGES = 10;

// Keep files in memory; they are streamed straight to Cloudinary
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: MAX_IMAGES },
  fileFilter(req, file, cb) {
    if (ALLOWED_TYPES.includes(file.mimetype)) return cb(null, true);

    const error = new Error("Only JPG, PNG, WEBP or AVIF images are allowed");
    error.statusCode = 400;
    cb(error);
  },
});

// Field name the frontend must use: formData.append("images", file)
export const uploadProductImages = upload.array("images", MAX_IMAGES);
