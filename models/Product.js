import mongoose from "mongoose";

// Main product type — every product belongs to exactly one
export const CATEGORIES = ["rings", "necklaces", "earrings", "bracelets", "watches"];

// Curated collections — a product can belong to several (or none)
export const COLLECTIONS = ["fine-jewellery", "80s-collection"];

// Navbar items and the filter each one maps to.
// "New Arrivals" is driven by the isNewArrival flag, the rest by category or collection.
export const MENU = [
  { label: "NEW ARRIVALS", slug: "new-arrivals", filter: { isNewArrival: true } },
  { label: "RINGS", slug: "rings", filter: { category: "rings" } },
  { label: "NECKLACES", slug: "necklaces", filter: { category: "necklaces" } },
  { label: "EARRINGS", slug: "earrings", filter: { category: "earrings" } },
  { label: "BRACELETS", slug: "bracelets", filter: { category: "bracelets" } },
  { label: "FINE JEWELLERY", slug: "fine-jewellery", filter: { collections: "fine-jewellery" } },
  { label: "80S COLLECTION", slug: "80s-collection", filter: { collections: "80s-collection" } },
  { label: "WATCHES", slug: "watches", filter: { category: "watches" } },
];

const slugify = (text) =>
  text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// One selectable size, e.g. "US 5" for rings or "16 Inch" for necklaces
const sizeSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    stock: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const imageSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, trim: true },
    publicId: { type: String, trim: true, default: "" }, // Cloudinary id, used to delete the image
    alt: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, "Product name is required"], trim: true },
    slug: { type: String, unique: true, lowercase: true, trim: true },
    sku: {
      type: String,
      required: [true, "SKU is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    brand: { type: String, default: "ZELORA FINE JEWELLERY", trim: true },

    category: {
      type: String,
      required: [true, "Category is required"],
      enum: { values: CATEGORIES, message: "Invalid category: {VALUE}" },
    },
    collections: {
      type: [{ type: String, enum: { values: COLLECTIONS, message: "Invalid collection: {VALUE}" } }],
      default: [],
    },
    isNewArrival: { type: Boolean, default: false },

    price: { type: Number, required: [true, "Price is required"], min: 0 },
    currency: { type: String, default: "PKR", uppercase: true, trim: true },
    priceNote: {
      type: String,
      default: "Taxes & Insured Express Shipping Included",
      trim: true,
    },

    description: { type: String, trim: true, default: "" },
    badge: { type: String, trim: true, default: "" }, // e.g. "HAUTE JOAILLERIE"
    images: { type: [imageSchema], default: [] },

    sizeLabel: { type: String, trim: true, default: "Size" }, // heading shown above the sizes
    sizes: { type: [sizeSchema], default: [] },
    stock: { type: Number, default: 0, min: 0 }, // used when the product has no sizes

    specifications: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ collections: 1, isActive: 1 });
productSchema.index({ isNewArrival: 1, isActive: 1 });
productSchema.index({ name: "text", description: "text" });

productSchema.pre("validate", function () {
  if (this.name && (!this.slug || this.isModified("name"))) {
    this.slug = slugify(this.name);
  }
});

export const Product = mongoose.model("Product", productSchema);
