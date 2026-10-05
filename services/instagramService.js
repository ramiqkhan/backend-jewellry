import mongoose from "mongoose";
import { InstagramPost } from "../models/InstagramPost.js";
import { uploadMedia, deleteMedia, videoPosterUrl } from "./cloudinaryService.js";
import { MAX_IMAGE_SIZE } from "../middleware/upload.js";

const FOLDER = () => process.env.CLOUDINARY_INSTAGRAM_FOLDER || "zelora/instagram";

// Fields a client is allowed to set. The media is only changed by uploading a file.
const EDITABLE_FIELDS = ["postUrl", "caption", "sortOrder", "isActive"];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function pickEditable(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => EDITABLE_FIELDS.includes(key)));
}

// The account shown above the strip, e.g. "@ICEBORN_OFFICIAL"
export function getProfile() {
  const handle = (process.env.INSTAGRAM_HANDLE || "").replace(/^@/, "").trim();
  return {
    handle: handle ? `@${handle}` : "",
    url: handle ? `https://www.instagram.com/${handle}/` : "",
  };
}

// Where a tile links to: the post itself, or the profile if no post link was given
function withLink(post, profileUrl) {
  return { ...post, link: post.postUrl || profileUrl };
}

function checkFile(file) {
  if (file.mimetype.startsWith("image/") && file.size > MAX_IMAGE_SIZE) {
    throw httpError(400, "Images must be 5MB or smaller");
  }
}

async function uploadPostMedia(file) {
  const uploaded = await uploadMedia(file, FOLDER());
  return {
    media: { url: uploaded.url, publicId: uploaded.publicId, type: uploaded.type },
    posterUrl: uploaded.type === "video" ? videoPosterUrl(uploaded.publicId) : "",
  };
}

// GET for the site: active posts only. Dashboard passes includeInactive=true.
export async function getPosts(query = {}) {
  const filter = query.includeInactive === "true" ? {} : { isActive: true };
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 50);
  const profile = getProfile();

  const posts = await InstagramPost.find(filter).sort({ sortOrder: 1, createdAt: -1 }).limit(limit).lean();

  return { profile, posts: posts.map((post) => withLink(post, profile.url)) };
}

export async function getPost(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid post id");

  const post = await InstagramPost.findById(id).lean();
  if (!post) throw httpError(404, "Instagram post not found");
  return withLink(post, getProfile().url);
}

// multipart/form-data: "media" file (photo or video) plus postUrl, caption, sortOrder, isActive
export async function createPost(data, file) {
  if (!file) throw httpError(400, "Please upload a photo or video in the \"media\" field");
  checkFile(file);

  const post = new InstagramPost(pickEditable(data));

  // Validate before uploading so a bad request doesn't leave an orphan file
  post.media = { url: "pending", type: file.mimetype.startsWith("video/") ? "video" : "image" };
  await post.validate();

  const uploaded = await uploadPostMedia(file);
  post.set(uploaded);

  try {
    await post.save();
  } catch (error) {
    await deleteMedia(uploaded.media.publicId, uploaded.media.type);
    throw error;
  }
  return withLink(post.toObject(), getProfile().url);
}

// A new "media" file replaces the old one
export async function updatePost(id, data = {}, file) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid post id");

  const post = await InstagramPost.findById(id);
  if (!post) throw httpError(404, "Instagram post not found");
  if (file) checkFile(file);

  const old = { publicId: post.media.publicId, type: post.media.type };
  post.set(pickEditable(data));
  await post.validate();

  let uploaded = null;
  if (file) {
    uploaded = await uploadPostMedia(file);
    post.set(uploaded);
  }

  try {
    await post.save();
  } catch (error) {
    if (uploaded) await deleteMedia(uploaded.media.publicId, uploaded.media.type);
    throw error;
  }

  // Only delete the old file once the post no longer uses it
  if (uploaded) await deleteMedia(old.publicId, old.type);
  return withLink(post.toObject(), getProfile().url);
}

export async function deletePost(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid post id");

  const post = await InstagramPost.findByIdAndDelete(id);
  if (!post) throw httpError(404, "Instagram post not found");

  await deleteMedia(post.media.publicId, post.media.type);
  return post;
}
