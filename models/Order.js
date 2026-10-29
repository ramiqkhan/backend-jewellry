import mongoose from "mongoose";

export const ORDER_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];
export const PAYMENT_METHODS = ["cod", "bank-transfer"];
export const PAYMENT_STATUSES = ["pending", "paid", "refunded"];

// Which status an order may move to from its current one
export const STATUS_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

// A snapshot of the product at the time of purchase, so later edits don't change old orders
const orderItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    name: { type: String, required: true, trim: true },
    sku: { type: String, required: true, trim: true },
    slug: { type: String, trim: true, default: "" },
    image: { type: String, trim: true, default: "" },
    size: { type: String, trim: true, default: "" }, // empty when the product has no sizes
    price: { type: Number, required: true, min: 0 }, // what the customer paid per piece
    originalPrice: { type: Number, min: 0 }, // list price before any discount
    quantity: { type: Number, required: true, min: 1 },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, enum: ORDER_STATUSES, required: true },
    note: { type: String, trim: true, default: "" },
    at: { type: Date, default: Date.now },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true, uppercase: true, trim: true },

    customer: {
      name: { type: String, required: [true, "Customer name is required"], trim: true },
      email: {
        type: String,
        required: [true, "Email is required"],
        lowercase: true,
        trim: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
      },
      phone: { type: String, required: [true, "Phone number is required"], trim: true },
      // Optional second number, used if the main one can't be reached (e.g. by the courier)
      alternativePhone: {
        type: String,
        trim: true,
        default: "",
        maxlength: [30, "Alternative phone number is too long"],
      },
    },

    shippingAddress: {
      line1: { type: String, required: [true, "Address is required"], trim: true },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, required: [true, "City is required"], trim: true },
      province: { type: String, trim: true, default: "" },
      postalCode: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "Pakistan" },
    },

    items: {
      type: [orderItemSchema],
      validate: [(items) => items.length > 0, "Order must have at least one item"],
    },

    subtotal: { type: Number, required: true, min: 0 },
    shippingFee: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: "PKR", uppercase: true, trim: true },

    paymentMethod: {
      type: String,
      enum: { values: PAYMENT_METHODS, message: "Invalid payment method: {VALUE}" },
      default: "cod",
    },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending" },

    status: { type: String, enum: ORDER_STATUSES, default: "pending" },
    statusHistory: { type: [statusHistorySchema], default: [] },

    notes: { type: String, trim: true, default: "" }, // customer's note at checkout
  },
  { timestamps: true }
);

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ "customer.email": 1, createdAt: -1 });

// Sequential order numbers: ZLR-100001, ZLR-100002, ...
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});
const Counter = mongoose.model("Counter", counterSchema);

export async function nextOrderNumber() {
  const counter = await Counter.findByIdAndUpdate(
    "order",
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true }
  );
  return `ZLR-${100000 + counter.seq}`;
}

export const Order = mongoose.model("Order", orderSchema);
