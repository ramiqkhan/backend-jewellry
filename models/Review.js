import mongoose from "mongoose";

// A customer review shown on the site. Usually a screenshot (DM, story, unboxing photo),
// optionally with the customer's name, a quote and a star rating.
const reviewSchema = new mongoose.Schema(
  {
    image: {
      url: { type: String, trim: true, default: "" },
      publicId: { type: String, trim: true, default: "" }, // Cloudinary id, used to delete the image
    },
    customerName: { type: String, trim: true, default: "", maxlength: [80, "Name is too long"] },
    text: { type: String, trim: true, default: "", maxlength: [1000, "Review text is too long"] },
    rating: {
      type: Number,
      min: [1, "Rating must be between 1 and 5"],
      max: [5, "Rating must be between 1 and 5"],
      default: null,
    },

    // Optional: show this review on a product page too
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", default: null },

    sortOrder: { type: Number, default: 0 }, // lower shows first
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

reviewSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });
reviewSchema.index({ product: 1, isActive: 1 });

reviewSchema.pre("validate", function () {
  if (!this.image?.url && !this.text) {
    this.invalidate("image", "A review needs a screenshot image or some text");
  }
});

export const Review = mongoose.model("Review", reviewSchema);
