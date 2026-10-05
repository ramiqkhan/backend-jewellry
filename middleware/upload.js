import multer from "multer";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];

export const MAX_IMAGES = 10;
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024;

function allowOnly(types, message) {
  return (req, file, cb) => {
    if (types.includes(file.mimetype)) return cb(null, true);

    const error = new Error(message);
    error.statusCode = 400;
    cb(error);
  };
}

// Keep files in memory; they are streamed straight to Cloudinary
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: MAX_IMAGES },
  fileFilter: allowOnly(IMAGE_TYPES, "Only JPG, PNG, WEBP or AVIF images are allowed"),
});

// Field name the frontend must use: formData.append("images", file)
export const uploadProductImages = upload.array("images", MAX_IMAGES);

// Customer review screenshot: formData.append("image", file)
export const uploadReviewImage = upload.single("image");

// Instagram post, photo or reel: formData.append("media", file)
// Multer has one size limit per uploader, so the 5MB image limit is checked in the service
export const uploadInstagramMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_SIZE, files: 1 },
  fileFilter: allowOnly(
    [...IMAGE_TYPES, ...VIDEO_TYPES],
    "Only JPG, PNG, WEBP, AVIF images or MP4, MOV, WEBM videos are allowed"
  ),
}).single("media");
