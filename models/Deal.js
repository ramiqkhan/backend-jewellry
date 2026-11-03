import mongoose from "mongoose";

export const MAX_DEAL_PERCENT = 90;

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// A sale campaign made in the dashboard, e.g. "Eid Sale – 30% off" on a set of products.
// While it's visible, its discount is written onto each product's `discount` (with discount.deal
// pointing back here), so the store, cart and checkout all charge the deal price automatically.
const dealSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, "Deal title is required"], trim: true, maxlength: [100, "Title is too long"] },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    subtitle: { type: String, trim: true, default: "", maxlength: [300, "Subtitle is too long"] },
    badge: { type: String, trim: true, default: "", maxlength: [30, "Badge is too long"] }, // e.g. "FLASH SALE"

    banner: {
      url: { type: String, trim: true, default: "" },
      publicId: { type: String, trim: true, default: "" }, // Cloudinary id, used to delete the image
    },

    percent: {
      type: Number,
      required: [true, "Discount % is required"],
      min: [1, "Discount must be at least 1%"],
      max: [MAX_DEAL_PERCENT, `Discount can't be more than ${MAX_DEAL_PERCENT}%`],
    },
    startsAt: { type: Date, default: null }, // null = starts immediately
    endsAt: { type: Date, default: null }, // null = runs until you hide or delete it

    products: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],

    sortOrder: { type: Number, default: 0 }, // lower shows first on the Deals page
    isActive: { type: Boolean, default: true }, // hidden deals don't discount anything
  },
  { timestamps: true }
);

dealSchema.index({ isActive: 1, sortOrder: 1, createdAt: -1 });

dealSchema.pre("validate", function () {
  if (this.title && (!this.slug || this.isModified("title"))) {
    this.slug = slugify(this.title);
  }
  if (this.startsAt && this.endsAt && this.endsAt <= this.startsAt) {
    this.invalidate("endsAt", "End date must be after the start date");
  }
  // Each product once, whatever the client sent
  const unique = [...new Set(this.products.map(String))];
  if (unique.length !== this.products.length) this.products = unique;
});

// 'hidden' | 'scheduled' | 'live' | 'ended'
export function dealStatus(deal, now = new Date()) {
  if (!deal.isActive) return "hidden";
  if (deal.startsAt && new Date(deal.startsAt) > now) return "scheduled";
  if (deal.endsAt && new Date(deal.endsAt) < now) return "ended";
  return "live";
}

export const Deal = mongoose.model("Deal", dealSchema);
