import mongoose from "mongoose";
import { Review } from "../models/Review.js";
import { Product } from "../models/Product.js";
import { uploadMedia, deleteMedia } from "./cloudinaryService.js";

const FOLDER = () => process.env.CLOUDINARY_REVIEWS_FOLDER || "zelora/reviews";

// Fields a client is allowed to set. The image is only changed by uploading a file or removeImage.
const EDITABLE_FIELDS = ["customerName", "text", "rating", "product", "sortOrder", "isActive"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Form fields arrive as strings; an empty rating/product means "none"
function pickEditable(data = {}) {
  const picked = Object.fromEntries(Object.entries(data).filter(([key]) => EDITABLE_FIELDS.includes(key)));
  for (const key of ["rating", "product"]) {
    if (picked[key] === "" || picked[key] === "null") picked[key] = null;
  }
  return picked;
}

async function checkProduct(productId) {
  if (productId && !(await Product.exists({ _id: productId }))) {
    throw httpError(400, "Linked product not found");
  }
}

// GET for the site: active reviews only. Dashboard passes includeInactive=true.
export async function getReviews(query = {}) {
  const filter = {};
  if (query.includeInactive !== "true") filter.isActive = true;
  if (query.product) {
    if (!mongoose.isValidObjectId(query.product)) throw httpError(400, "Invalid product id");
    filter.product = query.product;
  }

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);

  const [reviews, total] = await Promise.all([
    Review.find(filter)
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("product", "name slug")
      .lean(),
    Review.countDocuments(filter),
  ]);

  return {
    reviews,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function getReview(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid review id");

  const review = await Review.findById(id).populate("product", "name slug").lean();
  if (!review) throw httpError(404, "Review not found");
  return review;
}

// multipart/form-data: optional "image" file plus customerName, text, rating, product, sortOrder, isActive
export async function createReview(data, file) {
  const review = new Review(pickEditable(data));
  await checkProduct(review.product);

  // Validate before uploading so a bad request doesn't leave an orphan image
  if (file) review.image = { url: "pending" };
  await review.validate();

  let uploaded = null;
  if (file) {
    uploaded = await uploadMedia(file, FOLDER());
    review.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  try {
    await review.save();
  } catch (error) {
    await deleteMedia(uploaded?.publicId);
    throw error;
  }
  // Same shape as the GET endpoints, so the dashboard can show the product name
  return review.populate("product", "name slug");
}

// A new "image" file replaces the old one; removeImage=true deletes it
export async function updateReview(id, data = {}, file) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid review id");

  const review = await Review.findById(id);
  if (!review) throw httpError(404, "Review not found");

  const oldPublicId = review.image?.publicId;
  const replacingImage = Boolean(file) || data.removeImage === "true" || data.removeImage === true;

  review.set(pickEditable(data));
  await checkProduct(review.product);

  if (file) review.image = { url: "pending" };
  else if (replacingImage) review.image = { url: "", publicId: "" };
  await review.validate();

  let uploaded = null;
  if (file) {
    uploaded = await uploadMedia(file, FOLDER());
    review.image = { url: uploaded.url, publicId: uploaded.publicId };
  }

  try {
    await review.save();
  } catch (error) {
    await deleteMedia(uploaded?.publicId);
    throw error;
  }

  // Only delete the old image once the review no longer uses it
  if (replacingImage) await deleteMedia(oldPublicId);
  return review.populate("product", "name slug");
}

export async function deleteReview(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid review id");

  const review = await Review.findByIdAndDelete(id);
  if (!review) throw httpError(404, "Review not found");

  await deleteMedia(review.image?.publicId);
  return review;
}
