import mongoose from "mongoose";

export const MEDIA_TYPES = ["image", "video"];

// One tile in the "Follow us on Instagram" strip: a photo or reel that links to the real post
const instagramPostSchema = new mongoose.Schema(
  {
    media: {
      url: { type: String, required: [true, "Media file is required"], trim: true },
      publicId: { type: String, trim: true, default: "" }, // Cloudinary id, used to delete the file
      type: { type: String, enum: MEDIA_TYPES, required: true },
    },
    posterUrl: { type: String, trim: true, default: "" }, // thumbnail for videos

    postUrl: {
      type: String,
      trim: true,
      default: "",
      match: [/^https:\/\/(www\.)?instagram\.com\//i, "Post link must be an instagram.com URL"],
    },
    caption: { type: String, trim: true, default: "", maxlength: [150, "Caption is too long"] }, // shown on hover

    sortOrder: { type: Number, default: 0 }, // lower shows first
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

instagramPostSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

export const InstagramPost = mongoose.model("InstagramPost", instagramPostSchema);
