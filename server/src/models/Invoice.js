import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    invoiceId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Booking",
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    invoiceNumber: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "DRAFT",
        "CREATED",
        "SENT",
        "PAID",
        "CANCELLED",
        "UPDATED",
        "REFUNDED",
        "SCHEDULED",
        "PAYMENT_FAILED",
        "REMINDER_SENT",
        "DELETED",
        "MARKED_AS_PAID",
      ],
      default: "CREATED",
    },
    amount: {
      type: Number,
      min: 0,
    },
    currency: {
      type: String,
      default: "USD",
      trim: true,
    },
    invoiceUrl: {
      type: String,
      trim: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
    },
    recipientName: {
      type: String,
      trim: true,
    },
    note: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
    },
    cancelledAt: {
      type: Date,
    },
    rawDetails: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
);

export const Invoice = mongoose.model("Invoice", invoiceSchema);
