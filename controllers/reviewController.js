import * as reviewService from "../services/reviewService.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here

// GET /api/reviews?product=&includeInactive=&page=1&limit=12
export async function getReviews(req, res) {
  const result = await reviewService.getReviews(req.query);
  res.json({ success: true, ...result });
}

// GET /api/reviews/:id
export async function getReview(req, res) {
  const review = await reviewService.getReview(req.params.id);
  res.json({ success: true, review });
}

// POST /api/reviews  (multipart/form-data: "image" file, customerName, text, rating, product, sortOrder, isActive)
export async function createReview(req, res) {
  const review = await reviewService.createReview(req.body, req.file);
  res.status(201).json({ success: true, review });
}

// PATCH /api/reviews/:id  (multipart/form-data: new "image" replaces the old one, removeImage=true deletes it)
export async function updateReview(req, res) {
  const review = await reviewService.updateReview(req.params.id, req.body, req.file);
  res.json({ success: true, review });
}

// DELETE /api/reviews/:id
export async function deleteReview(req, res) {
  await reviewService.deleteReview(req.params.id);
  res.json({ success: true, message: "Review deleted" });
}
