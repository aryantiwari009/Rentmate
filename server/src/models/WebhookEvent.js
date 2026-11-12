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
      enum: ["PROCESSING", "PROCESSED", "IGNORED", "FAILED"],
      default: "PROCESSING",
    },
    attempts: {
      type: Number,
      default: 1,
    },
    lastError: {
      type: String,
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
