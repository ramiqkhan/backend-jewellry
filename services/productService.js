import mongoose from "mongoose";
import {
  Product,
  CATEGORIES,
  COLLECTIONS,
  GENDERS,
  MENU,
  withPricing,
  onSaleFilter,
} from "../models/Product.js";
import { uploadImages, deleteImages } from "./cloudinaryService.js";
import { MAX_IMAGES } from "../middleware/upload.js";

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "price-asc": { price: 1 },
  "price-desc": { price: -1 },
  "name-asc": { name: 1 },
};

// Fields a client is allowed to set on create/update.
// Images are not here: they are only added by uploading files and removed via removeImages.
const EDITABLE_FIELDS = [
  "name",
  "sku",
  "brand",
  "category",
  "collections",
  "isNewArrival",
  "gender",
  "price",
  "discount",
  "currency",
  "priceNote",
  "description",
  "badge",
  "sizeLabel",
  "sizes",
  "stock",
  "specifications",
  "isActive",
];

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

// Array/object fields arrive as JSON strings when sent as multipart/form-data
const JSON_FIELDS = ["collections", "sizes", "specifications", "discount", "removeImages", "imageAlts"];

function parseBody(data = {}) {
  const parsed = { ...data };
  for (const key of JSON_FIELDS) {
    if (typeof parsed[key] !== "string") continue;
    try {
      parsed[key] = JSON.parse(parsed[key]);
    } catch {
      throw httpError(400, `${key} must be valid JSON`);
    }
  }
  return parsed;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Fields a search term is matched against (partial, case-insensitive)
const SEARCH_FIELDS = ["name", "sku", "description", "badge", "category", "collections", "specifications"];
const MAX_SEARCH_TERMS = 8;

// "Gold  RING" -> ["gold", "ring"]
function searchTerms(q) {
  return String(q || "")
    .trim()
    .toLowerCase()
    .slice(0, 100)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, MAX_SEARCH_TERMS);
}

// Matches the term at the start of a word: "sol" finds "Solitaire", but "ring" doesn't find "earrings"
const wordStart = (term) => `(?<![a-z0-9])${escapeRegex(term)}`;

// Every term must appear in at least one field, so "gold ring" doesn't return gold necklaces
function searchFilter(terms) {
  return {
    $and: terms.map((term) => {
      const pattern = new RegExp(wordStart(term), "i");
      return { $or: SEARCH_FIELDS.map((field) => ({ [field]: pattern })) };
    }),
  };
}

// Higher score = better match. Name matches beat matches buried in the description.
function relevanceScore(q, terms) {
  const matches = (input, regex, points) => ({
    $cond: [{ $regexMatch: { input, regex, options: "i" } }, points, 0],
  });
  const phrase = escapeRegex(q.trim().toLowerCase());

  return {
    $add: [
      matches("$name", `^${phrase}$`, 100),
      matches("$sku", `^${phrase}$`, 100),
      matches("$name", `^${phrase}`, 40),
      matches("$name", phrase, 20),
      ...terms.map((term) => matches("$name", wordStart(term), 10)),
      ...terms.map((term) => matches("$category", `^${escapeRegex(term)}`, 5)),
    ],
  };
}

function pickEditable(data = {}) {
  return Object.fromEntries(Object.entries(data).filter(([key]) => EDITABLE_FIELDS.includes(key)));
}

// Optional imageAlts: ["alt for 1st file", "alt for 2nd file", ...]
function withAlts(uploaded, alts = [], fallback = "") {
  return uploaded.map((img, i) => ({ ...img, alt: alts[i] || fallback }));
}

// Turns query-string params into a Mongo filter
function buildFilter(query = {}) {
  const filter = {};

  if (query.includeInactive !== "true") filter.isActive = true;
  if (query.category) filter.category = query.category.toLowerCase();
  if (query.collection) filter.collections = query.collection.toLowerCase();
  if (query.newArrival === "true") filter.isNewArrival = true;
  // ?gender=women also includes unisex pieces (same for men).
  // null matches products saved before gender existed, which count as unisex.
  if (GENDERS.includes(query.gender)) {
    filter.gender = { $in: query.gender === "unisex" ? ["unisex", null] : [query.gender, "unisex", null] };
  }

  if (query.minPrice || query.maxPrice) {
    filter.price = {};
    if (query.minPrice) filter.price.$gte = Number(query.minPrice);
    if (query.maxPrice) filter.price.$lte = Number(query.maxPrice);
  }

  if (query.size) filter["sizes.label"] = query.size;

  const terms = searchTerms(query.search);
  if (terms.length) Object.assign(filter, searchFilter(terms));

  // ?onSale=true: only products with a discount running today
  if (query.onSale === "true") {
    const { $and, ...rest } = onSaleFilter();
    Object.assign(filter, rest);
    filter.$and = [...(filter.$and || []), ...$and];
  }

  return filter;
}

async function paginate(filter, query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);
  const sort = SORT_OPTIONS[query.sort] || SORT_OPTIONS.newest;

  const [products, total] = await Promise.all([
    Product.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Product.countDocuments(filter),
  ]);

  return {
    products: products.map(withPricing),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

export function getProducts(query) {
  return paginate(buildFilter(query), query);
}

export function getMenu() {
  return MENU.map(({ label, slug }) => ({ label, slug }));
}

// Products for one navbar item, e.g. "rings", "new-arrivals", "80s-collection"
export async function getProductsByMenu(menuSlug, query = {}) {
  const item = MENU.find((m) => m.slug === menuSlug.toLowerCase());
  if (!item) throw httpError(404, `Menu item "${menuSlug}" not found`);

  const filter = { ...buildFilter(query), ...item.filter };
  const result = await paginate(filter, query);

  return { menu: { label: item.label, slug: item.slug }, ...result };
}

// Search results page: ranked by relevance, with filter counts for the sidebar.
// Accepts the same filters as getProducts (category, collection, minPrice, maxPrice, size, newArrival, sort, page, limit).
export async function searchProducts(query = {}) {
  const q = String(query.q || "").trim();
  const terms = searchTerms(q);
  if (!terms.length) throw httpError(400, "Search query (q) is required");

  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 12, 1), 100);
  const sort = SORT_OPTIONS[query.sort] || { score: -1, createdAt: -1 };

  const filter = buildFilter({ ...query, search: q });
  // Facets ignore the sidebar filters, so customers can see what switching to them would give
  const facetFilter = { isActive: true, ...searchFilter(terms) };

  const [[result], [facets]] = await Promise.all([
    Product.aggregate([
      { $match: filter },
      { $addFields: { score: relevanceScore(q, terms) } },
      {
        $facet: {
          products: [{ $sort: sort }, { $skip: (page - 1) * limit }, { $limit: limit }, { $unset: "score" }],
          total: [{ $count: "count" }],
        },
      },
    ]),
    Product.aggregate([
      { $match: facetFilter },
      {
        $facet: {
          categories: [
            { $group: { _id: "$category", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          collections: [
            { $unwind: "$collections" },
            { $group: { _id: "$collections", count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } },
          ],
          priceRange: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
        },
      },
    ]),
  ]);

  const total = result.total[0]?.count || 0;
  const toCounts = (rows) => rows.map(({ _id, count }) => ({ value: _id, count }));

  return {
    query: q,
    products: result.products.map(withPricing),
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
    facets: {
      categories: toCounts(facets.categories),
      collections: toCounts(facets.collections),
      priceRange: facets.priceRange[0]
        ? { min: facets.priceRange[0].min, max: facets.priceRange[0].max }
        : null,
    },
  };
}

// Search-as-you-type dropdown: a few top products plus matching menu links
export async function getSearchSuggestions(q, limit = 6) {
  const terms = searchTerms(q);
  if (!terms.length) return { query: "", products: [], links: [] };

  const max = Math.min(Math.max(parseInt(limit, 10) || 6, 1), 10);
  const products = await Product.aggregate([
    { $match: { isActive: true, ...searchFilter(terms) } },
    { $addFields: { score: relevanceScore(q, terms) } },
    { $sort: { score: -1, name: 1 } },
    { $limit: max },
    {
      $project: {
        _id: 1,
        name: 1,
        slug: 1,
        sku: 1,
        category: 1,
        price: 1,
        discount: 1,
        currency: 1,
        image: { $arrayElemAt: ["$images", 0] },
      },
    },
  ]);

  // e.g. typing "ring" also offers a link to the RINGS page
  const links = MENU.filter(({ label }) => {
    const words = label.toLowerCase().split(/[\s-]+/);
    return terms.some((term) => words.some((word) => word.startsWith(term)));
  }).map(({ label, slug }) => ({ label, slug }));

  return { query: String(q).trim(), products: products.map(withPricing), links };
}

// Accepts either a Mongo id or a slug
export async function getProduct(idOrSlug) {
  const filter = mongoose.isValidObjectId(idOrSlug)
    ? { _id: idOrSlug }
    : { slug: idOrSlug.toLowerCase() };

  const product = await Product.findOne(filter).lean();
  if (!product) throw httpError(404, "Product not found");
  return withPricing(product);
}

export async function getProductBySku(sku) {
  const product = await Product.findOne({ sku: sku.toUpperCase() }).lean();
  if (!product) throw httpError(404, "Product not found");
  return withPricing(product);
}

export async function createProduct(data, files = []) {
  const body = parseBody(data);
  const product = new Product(pickEditable(body));

  // Validate before uploading so a bad request doesn't leave orphan images
  await product.validate();

  const uploaded = await uploadImages(files, product.category);
  product.images = withAlts(uploaded, body.imageAlts, product.name);

  try {
    return withPricing(await product.save());
  } catch (error) {
    await deleteImages(uploaded.map((img) => img.publicId));
    throw error;
  }
}

// New files are appended; removeImages is an array of publicIds to delete
export async function updateProduct(id, data, files = []) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid product id");

  const body = parseBody(data);
  const product = await Product.findById(id);
  if (!product) throw httpError(404, "Product not found");

  const removeIds = Array.isArray(body.removeImages) ? body.removeImages : [];
  const keptImages = product.images.filter((img) => !removeIds.includes(img.publicId));
  // Only ids that really belong to this product, so a client can't delete other assets
  const removedIds = product.images
    .filter((img) => removeIds.includes(img.publicId))
    .map((img) => img.publicId);

  if (keptImages.length + files.length > MAX_IMAGES) {
    throw httpError(400, `A product can have at most ${MAX_IMAGES} images`);
  }

  // save() (not findByIdAndUpdate) so the slug hook and validators run
  product.set(pickEditable(body));
  await product.validate();

  const uploaded = await uploadImages(files, product.category);
  product.images = [...keptImages, ...withAlts(uploaded, body.imageAlts, product.name)];

  try {
    await product.save();
  } catch (error) {
    await deleteImages(uploaded.map((img) => img.publicId));
    throw error;
  }

  // Only delete from Cloudinary once the product no longer references them
  await deleteImages(removedIds);
  return withPricing(product);
}

export async function deleteProduct(id) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid product id");

  const product = await Product.findByIdAndDelete(id);
  if (!product) throw httpError(404, "Product not found");

  await deleteImages(product.images.map((img) => img.publicId));
  return product;
}

export function getOptions() {
  return {
    categories: CATEGORIES,
    collections: COLLECTIONS,
    genders: GENDERS,
    sorts: Object.keys(SORT_OPTIONS),
  };
}
