import * as instagramService from "../services/instagramService.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here

// GET /api/instagram?includeInactive=&limit=12
export async function getPosts(req, res) {
  const result = await instagramService.getPosts(req.query);
  res.json({ success: true, ...result });
}

// GET /api/instagram/:id
export async function getPost(req, res) {
  const post = await instagramService.getPost(req.params.id);
  res.json({ success: true, post });
}

// POST /api/instagram  (multipart/form-data: "media" photo or video, postUrl, caption, sortOrder, isActive)
export async function createPost(req, res) {
  const post = await instagramService.createPost(req.body, req.file);
  res.status(201).json({ success: true, post });
}

// PATCH /api/instagram/:id  (multipart/form-data: new "media" replaces the old file)
export async function updatePost(req, res) {
  const post = await instagramService.updatePost(req.params.id, req.body, req.file);
  res.json({ success: true, post });
}

// DELETE /api/instagram/:id
export async function deletePost(req, res) {
  await instagramService.deletePost(req.params.id);
  res.json({ success: true, message: "Instagram post deleted" });
}
