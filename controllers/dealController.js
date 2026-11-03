import * as dealService from "../services/dealService.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here

// GET /api/deals            -> live deals with their products (store Deals page)
// GET /api/deals?includeInactive=true -> every deal with its status (dashboard, admin only)
export async function getDeals(req, res) {
  const result = await dealService.getDeals(req.query);
  res.json({ success: true, ...result });
}

// GET /api/deals/:idOrSlug
export async function getDeal(req, res) {
  const deal = await dealService.getDeal(req.params.idOrSlug, { admin: Boolean(req.admin) });
  res.json({ success: true, deal });
}

// POST /api/deals  (multipart/form-data: "banner" file, title, subtitle, badge, percent, startsAt, endsAt,
// products = JSON array of product ids, sortOrder, isActive)
export async function createDeal(req, res) {
  const deal = await dealService.createDeal(req.body, req.file);
  res.status(201).json({ success: true, deal });
}

// PATCH /api/deals/:id  (multipart/form-data or JSON; new "banner" replaces the old one, removeBanner=true deletes it)
export async function updateDeal(req, res) {
  const deal = await dealService.updateDeal(req.params.id, req.body, req.file);
  res.json({ success: true, deal });
}

// DELETE /api/deals/:id
export async function deleteDeal(req, res) {
  await dealService.deleteDeal(req.params.id);
  res.json({ success: true, message: "Deal deleted" });
}
