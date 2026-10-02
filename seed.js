// Inserts sample products. Run with: npm run seed
// Image files are read from seed-images/ (e.g. seed-images/rings/royal-solitaire-1.jpg)
// and uploaded to Cloudinary the first time a product is seeded.
import "dotenv/config";

import fs from "node:fs/promises";
import path from "node:path";
import mongoose from "mongoose";
import { connectDB } from "./config/db.js";
import { configureCloudinary } from "./config/cloudinary.js";
import { uploadImage, deleteImages } from "./services/cloudinaryService.js";
import { Product } from "./models/Product.js";

const SEED_IMAGES_DIR = path.join(import.meta.dirname, "seed-images");

const products = [
  {
    name: "The Royal Solitaire Diamond Ring",
    sku: "ZLR-RNG-01",
    category: "rings",
    collections: ["fine-jewellery"],
    isNewArrival: true,
    price: 185000,
    badge: "HAUTE JOAILLERIE",
    description:
      "Handcrafted in 18k solid yellow gold, featuring an extraordinary center-cut brilliant diamond. Designed for timeless elegance and designed to capture light from every angle.",
    images: [
      { file: "rings/royal-solitaire-1.jpg", alt: "Royal Solitaire Diamond Ring" },
      { file: "rings/royal-solitaire-2.jpg", alt: "Royal Solitaire Diamond Ring side view" },
      { file: "rings/royal-solitaire-3.jpg", alt: "Royal Solitaire Diamond Ring detail" },
    ],
    sizeLabel: "Select Size",
    sizes: ["US 5", "US 6", "US 7", "US 8", "US 9"].map((label) => ({ label, stock: 5 })),
    specifications: [
      "18K Solid Yellow Gold",
      "1.5 Carat Solitaire Cut Diamond",
      "VS1 Clarity, F Color Grade",
      "Hand-finished in our master atelier",
      "Includes Certificate of Authenticity",
    ],
  },
  {
    name: "Aura Emerald & Diamond Pendant",
    sku: "ZLR-NCK-01",
    category: "necklaces",
    collections: ["fine-jewellery"],
    isNewArrival: true,
    price: 245000,
    badge: "HAUTE JOAILLERIE",
    description:
      "A striking Colombian emerald surrounded by a halo of micro-pave diamonds, suspended on an adjustable 18k gold chain.",
    images: [
      { file: "necklaces/aura-emerald-1.jpg", alt: "Aura Emerald & Diamond Pendant" },
      { file: "necklaces/aura-emerald-2.jpg", alt: "Aura Emerald & Diamond Pendant flat lay" },
    ],
    sizeLabel: "Select Size",
    sizes: ["16 Inch", "18 Inch", "20 Inch"].map((label) => ({ label, stock: 5 })),
    specifications: [
      "18K Solid Gold Chain (18-20 inches)",
      "2.1 Carat Natural Colombian Emerald",
      "0.4 Carat Total Weight Round Diamonds",
      "Secure Lobster Lock Clasp",
    ],
  },
];

// Uploads the image files that exist locally; missing files are skipped with a warning
async function uploadSeedImages(images, category) {
  const uploaded = [];
  for (const { file, alt } of images) {
    let buffer;
    try {
      buffer = await fs.readFile(path.join(SEED_IMAGES_DIR, file));
    } catch {
      console.warn(`  Missing seed-images/${file} - skipped`);
      continue;
    }
    uploaded.push({ ...(await uploadImage({ buffer }, category)), alt });
  }
  return uploaded;
}

const seed = async () => {
  configureCloudinary();
  await connectDB();
  await Product.syncIndexes();

  for (const { images, ...data } of products) {
    // Upsert by SKU so re-running the seed doesn't create duplicates
    const product = (await Product.findOne({ sku: data.sku })) || new Product();
    product.set(data);

    // Only upload once: keep images that are already on Cloudinary
    let uploaded = [];
    if (!product.images.some((img) => img.publicId)) {
      uploaded = await uploadSeedImages(images, data.category);
      product.images = uploaded;
    }

    try {
      await product.save();
    } catch (error) {
      await deleteImages(uploaded.map((img) => img.publicId));
      throw error;
    }
    console.log(`Seeded ${data.sku} - ${data.name} (${product.images.length} images)`);
  }

  await mongoose.disconnect();
};

seed().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
