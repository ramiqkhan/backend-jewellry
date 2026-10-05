import * as reviewService from "../services/reviewService.js";
import * as instagramService from "../services/instagramService.js";

// GET /api/showcase?reviews=12&posts=12
// Everything the homepage needs in one request: customer reviews, then the Instagram strip below them
export async function getShowcase(req, res) {
  const [{ reviews }, instagram] = await Promise.all([
    reviewService.getReviews({ limit: req.query.reviews }),
    instagramService.getPosts({ limit: req.query.posts }),
  ]);
  res.json({ success: true, reviews, instagram });
}
