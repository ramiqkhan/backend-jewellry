import * as contactService from "../services/contactService.js";

// Express 5 forwards rejected promises to the error handler, so no try/catch needed here

// POST /api/contact  (JSON: fullName, email, phone, subject, message) — the store's contact form
export async function createMessage(req, res) {
  await contactService.createMessage(req.body);
  res.status(201).json({ success: true, message: "Thank you! We'll get back to you shortly." });
}

// GET /api/contact/options  -> { subjects: [{ value, label }], statuses }
export function getContactOptions(req, res) {
  res.json({ success: true, ...contactService.getContactOptions() });
}

// GET /api/contact?status=new&subject=&search=&page=1&limit=20
export async function getMessages(req, res) {
  const result = await contactService.getMessages(req.query);
  res.json({ success: true, ...result });
}

// GET /api/contact/:id
export async function getMessage(req, res) {
  const message = await contactService.getMessage(req.params.id);
  res.json({ success: true, contactMessage: message });
}

// PATCH /api/contact/:id  (JSON: status, adminNote)
export async function updateMessage(req, res) {
  const message = await contactService.updateMessage(req.params.id, req.body);
  res.json({ success: true, contactMessage: message });
}

// DELETE /api/contact/:id
export async function deleteMessage(req, res) {
  await contactService.deleteMessage(req.params.id);
  res.json({ success: true, message: "Message deleted" });
}
