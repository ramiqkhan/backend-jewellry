import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import {
  Order,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  STATUS_TRANSITIONS,
  nextOrderNumber,
} from "../models/Order.js";

const MAX_ITEMS = 20;
const MAX_QUANTITY = 10;

const SHIPPING_FEE = () => Number(process.env.SHIPPING_FEE) || 0;

const SORT_OPTIONS = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  "total-asc": { total: 1 },
  "total-desc": { total: -1 },
};

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Combines duplicate lines (same product + size) and checks the basic shape
function normalizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw httpError(400, "Order must have at least one item");

  const merged = new Map();
  for (const item of items) {
    const productId = item?.productId;
    const size = typeof item?.size === "string" ? item.size.trim() : "";
    const quantity = Number(item?.quantity ?? 1);

    if (!mongoose.isValidObjectId(productId)) throw httpError(400, "Invalid productId in items");
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw httpError(400, "Quantity must be a whole number of at least 1");
    }

    const key = `${productId}|${size}`;
    const existing = merged.get(key);
    merged.set(key, { productId, size, quantity: (existing?.quantity || 0) + quantity });
  }

  const list = [...merged.values()];
  if (list.length > MAX_ITEMS) throw httpError(400, `An order can have at most ${MAX_ITEMS} items`);
  for (const item of list) {
    if (item.quantity > MAX_QUANTITY) {
      throw httpError(400, `You can order at most ${MAX_QUANTITY} of each item`);
    }
  }
  return list;
}

// Decrements stock only if enough is left, so two buyers can't both take the last piece
async function reserveStock({ productId, size, quantity }) {
  const result = size
    ? await Product.updateOne(
        { _id: productId, isActive: true, sizes: { $elemMatch: { label: size, stock: { $gte: quantity } } } },
        { $inc: { "sizes.$.stock": -quantity } }
      )
    : await Product.updateOne(
        { _id: productId, isActive: true, stock: { $gte: quantity } },
        { $inc: { stock: -quantity } }
      );
  return result.modifiedCount === 1;
}

async function releaseStock({ product, size, quantity }) {
  if (size) {
    await Product.updateOne(
      { _id: product, "sizes.label": size },
      { $inc: { "sizes.$.stock": quantity } }
    );
  } else {
    await Product.updateOne({ _id: product }, { $inc: { stock: quantity } });
  }
}

async function releaseAll(items) {
  for (const item of items) {
    try {
      await releaseStock(item);
    } catch (error) {
      // Log and carry on so the remaining items still get their stock back
      console.error(`Failed to restore stock for ${item.sku || item.product}: ${error.message}`);
    }
  }
}

// Builds order lines from the database, never trusting prices sent by the client
async function buildOrderItems(requested) {
  const ids = requested.map((item) => item.productId);
  const products = await Product.find({ _id: { $in: ids }, isActive: true }).lean();
  const byId = new Map(products.map((p) => [p._id.toString(), p]));

  return requested.map(({ productId, size, quantity }) => {
    const product = byId.get(productId.toString());
    if (!product) throw httpError(400, `Product ${productId} is not available`);

    const hasSizes = product.sizes.length > 0;
    if (hasSizes && !size) throw httpError(400, `Please choose a size for ${product.name}`);
    if (hasSizes && !product.sizes.some((s) => s.label === size)) {
      throw httpError(400, `Size "${size}" is not available for ${product.name}`);
    }

    return {
      product: product._id,
      name: product.name,
      sku: product.sku,
      slug: product.slug,
      image: product.images[0]?.url || "",
      size: hasSizes ? size : "",
      price: product.price,
      quantity,
      lineTotal: product.price * quantity,
    };
  });
}

export async function createOrder(data = {}) {
  const requested = normalizeItems(data.items);
  const items = await buildOrderItems(requested);

  const paymentMethod = data.paymentMethod || "cod";
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw httpError(400, `Invalid payment method: ${paymentMethod}`);

  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0);
  const shippingFee = SHIPPING_FEE();

  const order = new Order({
    orderNumber: "PENDING", // replaced below, once validation has passed
    customer: data.customer,
    shippingAddress: data.shippingAddress,
    items,
    subtotal,
    shippingFee,
    total: subtotal + shippingFee,
    paymentMethod,
    notes: data.notes,
    statusHistory: [{ status: "pending", note: "Order placed" }],
  });

  // Validate before touching stock so a bad request changes nothing
  await order.validate();

  const reserved = [];
  for (const item of items) {
    const ok = await reserveStock({ productId: item.product, size: item.size, quantity: item.quantity });
    if (!ok) {
      await releaseAll(reserved);
      const label = item.size ? `${item.name} (${item.size})` : item.name;
      throw httpError(409, `Not enough stock for ${label}`);
    }
    reserved.push(item);
  }

  try {
    order.orderNumber = await nextOrderNumber();
    return await order.save();
  } catch (error) {
    await releaseAll(reserved);
    throw error;
  }
}

// Turns query-string params into a Mongo filter
function buildFilter(query = {}) {
  const filter = {};

  if (query.status) filter.status = query.status.toLowerCase();
  if (query.paymentStatus) filter.paymentStatus = query.paymentStatus.toLowerCase();
  if (query.paymentMethod) filter.paymentMethod = query.paymentMethod.toLowerCase();

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to) filter.createdAt.$lte = new Date(query.to);
  }

  // Matches order number, customer name, email or phone
  if (query.search) {
    const pattern = new RegExp(escapeRegex(query.search.trim()), "i");
    filter.$or = [
      { orderNumber: pattern },
      { "customer.name": pattern },
      { "customer.email": pattern },
      { "customer.phone": pattern },
    ];
  }

  return filter;
}

export async function getOrders(query = {}) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 20, 1), 100);
  const sort = SORT_OPTIONS[query.sort] || SORT_OPTIONS.newest;
  const filter = buildFilter(query);

  const [orders, total] = await Promise.all([
    Order.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Order.countDocuments(filter),
  ]);

  return {
    orders,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// Accepts either a Mongo id or an order number like ZLR-100001
export async function getOrder(idOrNumber) {
  const filter = mongoose.isValidObjectId(idOrNumber)
    ? { _id: idOrNumber }
    : { orderNumber: idOrNumber.toUpperCase() };

  const order = await Order.findOne(filter).lean();
  if (!order) throw httpError(404, "Order not found");
  return order;
}

// For customers: needs the email used at checkout so order numbers can't be guessed
export async function trackOrder(orderNumber, email) {
  if (!orderNumber || !email) throw httpError(400, "Order number and email are required");

  const order = await Order.findOne({
    orderNumber: String(orderNumber).trim().toUpperCase(),
    "customer.email": String(email).trim().toLowerCase(),
  }).lean();
  if (!order) throw httpError(404, "Order not found");
  return order;
}

// Moves an order along pending → confirmed → shipped → delivered, or cancels it
export async function updateOrderStatus(id, data = {}) {
  if (!mongoose.isValidObjectId(id)) throw httpError(400, "Invalid order id");

  const order = await Order.findById(id);
  if (!order) throw httpError(404, "Order not found");

  const { status, paymentStatus, note = "" } = data;
  if (!status && !paymentStatus) throw httpError(400, "Provide a status or paymentStatus to update");

  if (paymentStatus) {
    if (!PAYMENT_STATUSES.includes(paymentStatus)) throw httpError(400, `Invalid payment status: ${paymentStatus}`);
    order.paymentStatus = paymentStatus;
  }

  let restoreStock = false;
  if (status && status !== order.status) {
    if (!ORDER_STATUSES.includes(status)) throw httpError(400, `Invalid status: ${status}`);
    if (!STATUS_TRANSITIONS[order.status].includes(status)) {
      throw httpError(400, `Cannot change order from ${order.status} to ${status}`);
    }

    order.status = status;
    order.statusHistory.push({ status, note });

    if (status === "cancelled") restoreStock = true;
    // Cash on delivery is collected when the parcel is handed over
    if (status === "delivered" && order.paymentMethod === "cod" && !paymentStatus) {
      order.paymentStatus = "paid";
    }
  }

  await order.save();
  if (restoreStock) await releaseAll(order.items);
  return order;
}

export function getOrderOptions() {
  return {
    statuses: ORDER_STATUSES,
    transitions: STATUS_TRANSITIONS,
    paymentMethods: PAYMENT_METHODS,
    paymentStatuses: PAYMENT_STATUSES,
    sorts: Object.keys(SORT_OPTIONS),
  };
}
