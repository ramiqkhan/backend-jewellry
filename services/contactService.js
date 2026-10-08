import mongoose from "mongoose";
import { ContactMessage, CONTACT_SUBJECTS, MESSAGE_STATUSES } from "../models/ContactMessage.js";

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// From the store's contact form. Only these fields are accepted; status always starts as "new".
export async function createMessage(data = {}) {
  const message = new ContactMessage({
    fullName: data.fullName,
    email: data.email,
    phone: data.phone,
    subject: data.subject || undefined,
    message: data.message,
  });
  return message.save();
}

// Dashboard list: ?status=new&subject=&search=&page=1&limit=20
export async function getMessages(query = {}) {
  const filter = {};
  if (query.status) filter.status = query.status;
  if (query.subject) filter.subject = query.subject;

  // Matches name, email, phone or the message text
  if (query.search?.trim()) {
    const pattern = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [{ fullName: pattern }, { email: pattern }, { phone: pattern }, { message: pattern }];
  }

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);

  const [messages, total, statusCounts] = await Promise.all([
    ContactMessage.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    ContactMessage.countDocuments(filter),
    ContactMessage.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  // { all, new, read, replied } across every message, for the dashboard tabs
  const counts = Object.fromEntries(MESSAGE_STATUSES.map((status) => [status, 0]));
  for (const { _id, count } of statusCounts) counts[_id] = count;
  counts.all = MESSAGE_STATUSES.reduce((sum, status) => sum + counts[status], 0);

  return {
    messages,
    counts,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export async function getMessage(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid message id");

  const message = await ContactMessage.findById(id).lean();
  if (!message) throw httpError(404, "Message not found");
  return message;
}

// Dashboard: change status (new / read / replied) and the private note
export async function updateMessage(id, data = {}) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid message id");

  const message = await ContactMessage.findById(id);
  if (!message) throw httpError(404, "Message not found");

  if (data.status !== undefined) message.status = data.status;
  if (data.adminNote !== undefined) message.adminNote = data.adminNote;
  return message.save();
}

export async function deleteMessage(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid message id");

  const message = await ContactMessage.findByIdAndDelete(id);
  if (!message) throw httpError(404, "Message not found");
  return message;
}

export function getContactOptions() {
  return { subjects: CONTACT_SUBJECTS, statuses: MESSAGE_STATUSES };
}
