import mongoose from "mongoose";
import { Deal, dealStatus } from "../models/Deal.js";
import { Product, withPricing } from "../models/Product.js";
import { uploadMedia, deleteMedia } from "./cloudinaryService.js";

const FOLDER = () => process.env.CLOUDINARY_DEALS_FOLDER || "zelora/deals";

// Fields a client may set. The banner is only changed by uploading a file or removeBanner.
const EDITABLE_FIELDS = ["title", "subtitle", "badge", "percent", "startsAt", "endsAt", "products", "sortOrder", "isActive"];

// Product fields the Deals page needs for its cards
const PRODUCT_CARD_FIELDS = "name slug sku category price currency discount images sizes stock isActive";

const NO_DISCOUNT = { percent: 0, startsAt: null, endsAt: null, deal: null };

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// multipart/form-data sends everything as strings: products is a JSON array, empty dates mean "none"
function parseBody(data = {}) {
  const parsed = Object.fromEntries(Object.entries(data).filter(([key]) => EDITABLE_FIELDS.includes(key)));

  if (typeof parsed.products === "string") {
    try {
      parsed.products = JSON.parse(parsed.products);
    } catch {
      throw httpError(400, "products must be a JSON array of product ids");
    }
  }
  if (parsed.products !== undefined) {
    if (!Array.isArray(parsed.products)) throw httpError(400, "products must be an array of product ids");
    const bad = parsed.products.find((id) => !mongoose.isValidObjectId(id));
    if (bad) throw httpError(400, `Invalid product id: ${bad}`);
  }
  for (const key of ["startsAt", "endsAt"]) {
    if (parsed[key] === "" || parsed[key] === "null") parsed[key] = null;
  }
  return parsed;
}

// A product can only carry one deal's discount. Taking over is allowed once the other deal is
// over or hidden; otherwise the admin has to remove the product from that deal first.
async function checkConflicts(deal) {
  const ids = deal.products.map(String);
  if (!ids.length) return;

  const [found, taken] = await Promise.all([
    Product.find({ _id: { $in: ids } }, "_id").lean(),
    Product.find(
      { _id: { $in: ids }, "discount.deal": { $nin: [null, deal._id] } },
      "name discount.deal"
    )
      .populate("discount.deal", "title isActive startsAt endsAt")
      .lean(),
  ]);

  if (found.length !== ids.length) throw httpError(400, "Some selected products no longer exist");

  const blocking = taken.filter((p) => p.discount.deal && ["live", "scheduled"].includes(dealStatus(p.discount.deal)));
  if (blocking.length) {
    const list = blocking.map((p) => `"${p.name}" (in "${p.discount.deal.title}")`).join(", ");
    throw httpError(409, `Already in another deal: ${list}. Remove them from that deal first.`);
  }
}

// Writes this deal's discount onto its products, and removes it from products that left the deal.
// Hidden deals discount nothing; dates are copied, so prices go back to normal on their own when it ends.
async function syncProductDiscounts(deal) {
  const ids = deal.isActive ? deal.products : [];

  await Product.updateMany(
    { "discount.deal": deal._id, _id: { $nin: ids } },
    { $set: { discount: NO_DISCOUNT } }
  );
  if (ids.length) {
    await Product.updateMany(
      { _id: { $in: ids } },
      { $set: { discount: { percent: deal.percent, startsAt: deal.startsAt, endsAt: deal.endsAt, deal: deal._id } } }
    );
  }
}

// What the API sends back: status + products as store-ready cards (deleted products dropped)
function present(deal, { onlyVisibleProducts }) {
  const plain = typeof deal.toObject === "function" ? deal.toObject() : deal;
  const products = (plain.products || [])
    .filter((p) => p && typeof p === "object" && (!onlyVisibleProducts || p.isActive))
    .map(withPricing);
  return { ...plain, status: dealStatus(plain), products, productCount: products.length };
}

// Store: live deals only. Dashboard (?includeInactive=true): every deal, any status.
export async function getDeals(query = {}) {
  const admin = query.includeInactive === "true";
  const now = new Date();
  const filter = admin
    ? {}
    : {
        isActive: true,
        $and: [
          { $or: [{ startsAt: null }, { startsAt: { $lte: now } }] },
          { $or: [{ endsAt: null }, { endsAt: { $gte: now } }] },
        ],
      };

  const deals = await Deal.find(filter)
    .sort({ sortOrder: 1, createdAt: -1 })
    .populate("products", PRODUCT_CARD_FIELDS)
    .lean();

  const presented = deals.map((deal) => present(deal, { onlyVisibleProducts: !admin }));
  // The store has nothing to show for a deal whose products are all hidden
  return { deals: admin ? presented : presented.filter((deal) => deal.products.length) };
}

// Accepts a Mongo id or a slug. The store only gets live deals.
export async function getDeal(idOrSlug, { admin = false } = {}) {
  const filter = mongoose.isValidObjectId(idOrSlug) ? { _id: idOrSlug } : { slug: String(idOrSlug).toLowerCase() };
  const deal = await Deal.findOne(filter).populate("products", PRODUCT_CARD_FIELDS).lean();

  if (!deal || (!admin && dealStatus(deal) !== "live")) throw httpError(404, "Deal not found");
  return present(deal, { onlyVisibleProducts: !admin });
}

// multipart/form-data: optional "banner" file plus title, subtitle, badge, percent, startsAt, endsAt,
// products (JSON array of ids), sortOrder, isActive
export async function createDeal(data, file) {
  const deal = new Deal(parseBody(data));

  // Validate before uploading so a bad request doesn't leave an orphan image
  await deal.validate();
  await checkConflicts(deal);

  let uploaded = null;
  if (file) {
    uploaded = await uploadMedia(file, FOLDER());
    deal.banner = { url: uploaded.url, publicId: uploaded.publicId };
  }

  try {
    await deal.save();
  } catch (error) {
    await deleteMedia(uploaded?.publicId);
    throw error;
  }

  await syncProductDiscounts(deal);
  return getDeal(deal._id, { admin: true });
}

// A new "banner" file replaces the old one; removeBanner=true deletes it
export async function updateDeal(id, data = {}, file) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid deal id");

  const deal = await Deal.findById(id);
  if (!deal) throw httpError(404, "Deal not found");

  const oldBanner = deal.banner?.publicId;
  const replacingBanner = Boolean(file) || data.removeBanner === "true" || data.removeBanner === true;

  deal.set(parseBody(data));
  if (replacingBanner && !file) deal.banner = { url: "", publicId: "" };
  await deal.validate();
  await checkConflicts(deal);

  let uploaded = null;
  if (file) {
    uploaded = await uploadMedia(file, FOLDER());
    deal.banner = { url: uploaded.url, publicId: uploaded.publicId };
  }

  try {
    await deal.save();
  } catch (error) {
    await deleteMedia(uploaded?.publicId);
    throw error;
  }

  await syncProductDiscounts(deal);
  // Only delete the old banner once the deal no longer uses it
  if (replacingBanner) await deleteMedia(oldBanner);
  return getDeal(deal._id, { admin: true });
}

// Removes the deal and the discounts it put on its products
export async function deleteDeal(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid deal id");

  const deal = await Deal.findByIdAndDelete(id);
  if (!deal) throw httpError(404, "Deal not found");

  await Product.updateMany({ "discount.deal": deal._id }, { $set: { discount: NO_DISCOUNT } });
  await deleteMedia(deal.banner?.publicId);
  return deal;
}
