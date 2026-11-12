import mongoose from "mongoose";

const webhookEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
    },
    resourceId: {
      type: String,
      trim: true,
    },
    resourceType: {
      type: String,
      trim: true,
    },
    summary: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ["PROCESSED", "IGNORED", "FAILED"],
      default: "PROCESSED",
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    processedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export const WebhookEvent = mongoose.model("WebhookEvent", webhookEventSchema);
