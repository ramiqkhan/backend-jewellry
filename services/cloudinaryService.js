import cloudinary from "../config/cloudinary.js";

const BASE_FOLDER = () => process.env.CLOUDINARY_FOLDER || "zelora/products";

// Uploads one multer file (memory buffer) and returns { url, publicId }
export function uploadImage(file, subFolder = "") {
  const folder = subFolder ? `${BASE_FOLDER()}/${subFolder}` : BASE_FOLDER();

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "image" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(file.buffer);
  });
}

// Uploads an image or video into any folder and returns { url, publicId, type }
export function uploadMedia(file, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, publicId: result.public_id, type: result.resource_type });
      }
    );
    stream.end(file.buffer);
  });
}

// Deletes one image or video; videos need their resource type to be found
export async function deleteMedia(publicId, type = "image") {
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: type, invalidate: true });
  } catch (error) {
    // Cleanup failure shouldn't break the request
    console.error(`Cloudinary delete failed: ${error.message}`);
  }
}

// A JPG of a video's first frame, used as its thumbnail
export function videoPosterUrl(publicId) {
  return cloudinary.url(publicId, {
    resource_type: "video",
    format: "jpg",
    secure: true,
    transformation: [{ start_offset: "0" }],
  });
}

export async function uploadImages(files = [], subFolder = "") {
  const uploaded = [];
  try {
    for (const file of files) {
      uploaded.push(await uploadImage(file, subFolder));
    }
    return uploaded;
  } catch (error) {
    // Don't leave half an upload behind in Cloudinary
    await deleteImages(uploaded.map((img) => img.publicId));
    throw error;
  }
}

export async function deleteImages(publicIds = []) {
  const ids = publicIds.filter(Boolean);
  if (!ids.length) return;

  try {
    await cloudinary.api.delete_resources(ids);
  } catch (error) {
    // Cleanup failure shouldn't break the request
    console.error(`Cloudinary delete failed: ${error.message}`);
  }
}
