import mongoose from "mongoose";

// The "Subject / Interest" options on the store's contact form (value -> label)
export const CONTACT_SUBJECTS = [
  { value: "General Inquiries", label: "General Inquiries" },
  { value: "Bespoke Design", label: "Bespoke Design & Customization" },
  { value: "Private Viewing", label: "Private Appointment Booking" },
  { value: "Order Status", label: "Order Status & Logistics" },
  { value: "Watch Servicing", label: "Watch Servicing & Repair" },
];

// new: not opened yet · read: seen in the dashboard · replied: customer has been answered
export const MESSAGE_STATUSES = ["new", "read", "replied"];

const contactMessageSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      maxlength: [100, "Name is too long"],
    },
    email: {
      type: String,
      required: [true, "Email address is required"],
      lowercase: true,
      trim: true,
      maxlength: [150, "Email is too long"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please enter a valid email address"],
    },
    phone: { type: String, trim: true, default: "", maxlength: [30, "Phone number is too long"] },
    subject: {
      type: String,
      enum: { values: CONTACT_SUBJECTS.map((s) => s.value), message: "Invalid subject: {VALUE}" },
      default: "General Inquiries",
    },
    message: {
      type: String,
      required: [true, "Message is required"],
      trim: true,
      maxlength: [3000, "Message is too long (max 3000 characters)"],
    },

    status: {
      type: String,
      enum: { values: MESSAGE_STATUSES, message: "Status must be new, read or replied" },
      default: "new",
    },
    adminNote: { type: String, trim: true, default: "", maxlength: [1000, "Note is too long"] }, // private, dashboard only
  },
  { timestamps: true }
);

contactMessageSchema.index({ status: 1, createdAt: -1 });
contactMessageSchema.index({ createdAt: -1 });

export const ContactMessage = mongoose.model("ContactMessage", contactMessageSchema);
