import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Invoice } from "../models/Invoice.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { verifyWebhookSignature, recordInvoicePayment } from "../services/paypal.js";

const STATUS_RANKS = {
  DRAFT: 1,
  CREATED: 1,
  SCHEDULED: 2,
  SENT: 3,
  PAYMENT_FAILED: 4,
  PARTIALLY_PAID: 5,
  CANCELLED: 8,
  PAID: 10,
  PARTIALLY_REFUNDED: 11,
  REFUNDED: 12,
  DELETED: 13,
};

function resolvePayerUrl(resource, invoiceId) {
  if (resource?.detail?.metadata?.payer_view_url) {
    return resource.detail.metadata.payer_view_url;
  }
  const link = resource?.links?.find(
    (l) => l.rel === "payer-view" || l.rel === "payer_view"
  );
  if (link?.href) return link.href;

  const isSandbox = (process.env.PAYPAL_API || "").includes("sandbox");
  const host = isSandbox ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
  return `${host}/invoice/p/#${invoiceId}`;
}

export async function handlePayPalWebhook(req, res) {
  const event = req.body;

  // 1. Validate payload structure
  if (!event || !event.id || !event.event_type) {
    return res.status(400).json({ message: "Invalid webhook payload structure" });
  }

  const eventTimestamp = event.create_time ? new Date(event.create_time) : new Date();
  const resource = event.resource || {};

  // 2. Race-safe deduplication claim using atomic upsert
  let eventRecord;
  try {
    eventRecord = await WebhookEvent.findOneAndUpdate(
      { eventId: event.id },
      {
        $setOnInsert: {
          eventId: event.id,
          eventType: event.event_type,
          resourceId: resource.id,
          resourceType: event.resource_type,
          summary: event.summary,
          status: "PROCESSING",
          payload: event,
          processedAt: new Date(),
          attempts: 1,
        },
      },
      { upsert: true, new: false }
    );
  } catch (err) {
    if (err.code === 11000) {
      // E11000 concurrent insert collision: another worker just claimed it
      console.log(`[PayPal Webhook] Concurrent duplicate for event ${event.id}. Acknowledging.`);
      return res.status(200).json({ received: true, duplicate: true });
    }
    throw err;
  }

  // If already successfully processed, acknowledge duplicate without reprocessing
  if (eventRecord && eventRecord.status === "PROCESSED") {
    console.log(`[PayPal Webhook] Duplicate event ${event.id} already processed. Skipping.`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  // If previous attempt failed, allow retry
  if (eventRecord && eventRecord.status === "FAILED") {
    await WebhookEvent.updateOne(
      { eventId: event.id },
      { $set: { status: "PROCESSING" }, $inc: { attempts: 1 } }
    );
  }

  // 3. Official PayPal Signature Verification
  // Rule: Never mark payments successful or process changes without PayPal verification
  const verification = await verifyWebhookSignature({
    headers: req.headers,
    body: event,
  });

  if (!verification.verified) {
    console.error(
      `[PayPal Webhook] Signature verification failed for event ${event.id}:`,
      verification.error || verification.status
    );
    await WebhookEvent.updateOne(
      { eventId: event.id },
      {
        $set: {
          status: "FAILED",
          lastError: verification.error || "Signature verification failed",
        },
      }
    );
    return res.status(400).json({
      message: "Webhook signature verification failed",
      error: verification.error || "Invalid signature",
    });
  }

  const eventType = event.event_type;
  console.log(`[PayPal Webhook] Verified event ${eventType} (${event.id})`);

  try {
    // ------------------------------------------------------------------------
    // INVOICE EVENTS (ALL 9 OFFICIAL TYPES)
    // ------------------------------------------------------------------------
    if (eventType.startsWith("INVOICING.INVOICE.")) {
      const invoiceObj = resource.invoice || resource;
      const invoiceId = invoiceObj.id;

      if (invoiceId) {
        // Fetch existing invoice to check state transition hierarchy and timestamp
        const existingInvoice = await Invoice.findOne({ invoiceId });

        // Out-of-order check: if incoming event is older than last processed event
        const isOutOfOrder =
          existingInvoice?.lastEventTimestamp &&
          eventTimestamp < existingInvoice.lastEventTimestamp;

        let targetInvoiceStatus = null;
        let isHistoryOnly = false;

        if (eventType === "INVOICING.INVOICE.CREATED") {
          targetInvoiceStatus = "CREATED";
        } else if (eventType === "INVOICING.INVOICE.SENT") {
          targetInvoiceStatus = "SENT";
        } else if (eventType === "INVOICING.INVOICE.SCHEDULED") {
          targetInvoiceStatus = "SCHEDULED";
        } else if (eventType === "INVOICING.INVOICE.CANCELLED") {
          targetInvoiceStatus = "CANCELLED";
        } else if (eventType === "INVOICING.INVOICE.PAYMENT_FAILED") {
          targetInvoiceStatus = "PAYMENT_FAILED";
        } else if (eventType === "INVOICING.INVOICE.DELETED") {
          targetInvoiceStatus = "DELETED";
        } else if (eventType === "INVOICING.INVOICE.PAID") {
          // Check for full payment vs partial payment vs pending payment
          const rawStatus = invoiceObj.status;
          const dueVal = Number(
            invoiceObj.due_amount?.value ||
              invoiceObj.detail?.payment_term?.due_amount?.value ||
              0
          );
          if (rawStatus === "PARTIALLY_PAID" || dueVal > 0) {
            targetInvoiceStatus = "PARTIALLY_PAID";
          } else {
            targetInvoiceStatus = "PAID";
          }
        } else if (eventType === "INVOICING.INVOICE.REFUNDED") {
          // Check for full refund vs partial refund
          const rawStatus = invoiceObj.status;
          if (rawStatus === "PARTIALLY_REFUNDED") {
            targetInvoiceStatus = "PARTIALLY_REFUNDED";
          } else {
            targetInvoiceStatus = "REFUNDED";
          }
        } else if (eventType === "INVOICING.INVOICE.UPDATED") {
          // UPDATED: modify details and record in history; do NOT overwrite status with "UPDATED"
          isHistoryOnly = true;
          // If PayPal provided an explicit lifecycle status in resource, respect it
          if (invoiceObj.status && STATUS_RANKS[invoiceObj.status]) {
            targetInvoiceStatus = invoiceObj.status;
          }
        } else if (
          eventType === "INVOICING.INVOICE.AUTOMATIC-REMINDER-SENT" ||
          eventType === "INVOICING.INVOICE.AUTOMATIC_REMINDER_SENT"
        ) {
          // Reminder: record in history; do NOT overwrite status
          isHistoryOnly = true;
        }

        // Apply status transition safety: never downgrade from a terminal status
        let finalStatus = existingInvoice?.status || targetInvoiceStatus || "CREATED";
        if (targetInvoiceStatus && !isHistoryOnly && !isOutOfOrder) {
          const currentRank = STATUS_RANKS[existingInvoice?.status] || 0;
          const newRank = STATUS_RANKS[targetInvoiceStatus] || 0;
          if (newRank >= currentRank) {
            finalStatus = targetInvoiceStatus;
          }
        }

        const invoiceUrl = resolvePayerUrl(invoiceObj, invoiceId);
        const invoiceAmount = Number(
          invoiceObj.amount?.value || invoiceObj.detail?.payment_term?.due_amount?.value || 0
        );

        const historyEntry = {
          eventType,
          eventId: event.id,
          timestamp: eventTimestamp,
          summary: event.summary,
          details: invoiceObj,
        };

        const updateFields = {
          $set: {
            status: finalStatus,
            invoiceNumber: invoiceObj.detail?.invoice_number || existingInvoice?.invoiceNumber,
            amount: invoiceAmount || existingInvoice?.amount,
            currency:
              invoiceObj.amount?.currency_code ||
              invoiceObj.detail?.currency_code ||
              existingInvoice?.currency ||
              "USD",
            invoiceUrl: invoiceUrl || existingInvoice?.invoiceUrl,
            rawDetails: invoiceObj,
            lastEventTimestamp: eventTimestamp,
            ...(finalStatus === "PAID" ? { paidAt: eventTimestamp } : {}),
            ...(finalStatus === "CANCELLED" ? { cancelledAt: eventTimestamp } : {}),
            ...(finalStatus === "REFUNDED" || finalStatus === "PARTIALLY_REFUNDED"
              ? { refundedAt: eventTimestamp }
              : {}),
            ...(isHistoryOnly && eventType.includes("REMINDER")
              ? { lastReminderSentAt: eventTimestamp }
              : {}),
          },
          $push: {
            eventHistory: historyEntry,
          },
        };

        const invoiceDoc = await Invoice.findOneAndUpdate(
          { invoiceId },
          updateFields,
          { new: true, upsert: true }
        );

        // Update associated MongoDB Booking record
        const booking = await Booking.findOne({ paypalInvoiceId: invoiceId });
        if (booking) {
          const bookingIsOlder =
            booking.lastEventTimestamp && eventTimestamp < booking.lastEventTimestamp;

          if (!bookingIsOlder) {
            booking.paypalInvoiceStatus = finalStatus;
            booking.lastEventTimestamp = eventTimestamp;

            if (invoiceUrl && !booking.paypalInvoiceUrl) {
              booking.paypalInvoiceUrl = invoiceUrl;
            }

            if (finalStatus === "PAID") {
              booking.paymentStatus = "paid";
              booking.paidAt = booking.paidAt || eventTimestamp;
            } else if (finalStatus === "PARTIALLY_PAID") {
              // Partial payment never marks the full booking as paid
              booking.paymentStatus = "partially_paid";
            } else if (finalStatus === "REFUNDED") {
              booking.paymentStatus = "refunded";
              booking.refundedAt = booking.refundedAt || eventTimestamp;
            } else if (finalStatus === "PARTIALLY_REFUNDED") {
              booking.paymentStatus = "partially_refunded";
            } else if (finalStatus === "PAYMENT_FAILED") {
              booking.paymentStatus = "failed";
            } else if (finalStatus === "CANCELLED" && booking.paymentStatus === "pending") {
              booking.paypalInvoiceStatus = "CANCELLED";
            }

            await booking.save();
          }

          if (!invoiceDoc.booking) {
            invoiceDoc.booking = booking._id;
            invoiceDoc.user = booking.user;
            await invoiceDoc.save();
          }

          console.log(
            `[PayPal Webhook] Synced booking ${booking._id} for invoice ${invoiceId} -> ${finalStatus}`
          );
        }
      }
    }

    // ------------------------------------------------------------------------
    // PAYMENT EVENTS: COMPLETED, PENDING, DENIED, REFUNDED
    // ------------------------------------------------------------------------
    else if (eventType.startsWith("PAYMENT.CAPTURE.")) {
      const captureId = resource.id;
      const customId = resource.custom_id || resource.reference_id;
      const orderId =
        resource.supplementary_data?.related_ids?.order_id ||
        resource.parent_payment;

      let booking = null;
      if (customId && mongoose.isValidObjectId(customId)) {
        booking = await Booking.findById(customId);
      }
      if (!booking && captureId) {
        booking = await Booking.findOne({ paypalCaptureId: captureId });
      }
      if (!booking && orderId) {
        booking = await Booking.findOne({ paypalOrderId: orderId });
      }

      if (booking) {
        const bookingIsOlder =
          booking.lastEventTimestamp && eventTimestamp < booking.lastEventTimestamp;

        if (!bookingIsOlder) {
          booking.lastEventTimestamp = eventTimestamp;
          if (captureId && !booking.paypalCaptureId) {
            booking.paypalCaptureId = captureId;
          }

          if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
            booking.paymentStatus = "paid";
            booking.paidAt = booking.paidAt || eventTimestamp;
            console.log(`[PayPal Webhook] Booking ${booking._id} marked PAID via capture ${captureId}`);

            if (booking.paypalInvoiceId && booking.paypalInvoiceStatus !== "PAID") {
              try {
                const inrPerUsd = Number(process.env.INR_PER_USD) || 85;
                const usdAmount = Number((booking.total / inrPerUsd).toFixed(2));
                await recordInvoicePayment(booking.paypalInvoiceId, {
                  amount: usdAmount,
                  currency: process.env.PAYPAL_CURRENCY || "USD",
                  paymentDate: booking.paidAt,
                  note: `Paid via PayPal Checkout (Capture ID: ${captureId})`,
                  method: "PAYPAL",
                  paymentId: captureId,
                });
                booking.paypalInvoiceStatus = "PAID";
                await Invoice.updateOne(
                  { invoiceId: booking.paypalInvoiceId },
                  {
                    $set: { status: "PAID", paidAt: booking.paidAt },
                    $push: {
                      eventHistory: {
                        eventType: "PAYMENT.CAPTURE.COMPLETED",
                        eventId: event.id,
                        timestamp: eventTimestamp,
                        summary: `Invoice synchronized to PAID via capture ${captureId}`,
                      },
                    },
                  }
                );
              } catch (syncErr) {
                console.warn(`[PayPal Webhook] Sync payment to invoice ${booking.paypalInvoiceId} failed: ${syncErr.message}`);
              }
            }
          } else if (eventType === "PAYMENT.CAPTURE.PENDING") {
            // Pending payment never marks full rental as paid
            booking.paymentStatus = "pending";
            console.log(`[PayPal Webhook] Booking ${booking._id} marked PENDING via capture ${captureId}`);
          } else if (eventType === "PAYMENT.CAPTURE.DENIED") {
            booking.paymentStatus = "failed";
            console.log(`[PayPal Webhook] Booking ${booking._id} marked FAILED (DENIED) via capture ${captureId}`);
          } else if (eventType === "PAYMENT.CAPTURE.REFUNDED") {
            // Check for partial refund
            const isPartial =
              resource.amount &&
              resource.total_refunded_amount &&
              Number(resource.total_refunded_amount.value) < Number(resource.amount.value);
            booking.paymentStatus = isPartial ? "partially_refunded" : "refunded";
            booking.refundedAt = booking.refundedAt || eventTimestamp;
            console.log(
              `[PayPal Webhook] Booking ${booking._id} marked ${booking.paymentStatus} via capture ${captureId}`
            );
          }

          await booking.save();
        }
      } else {
        console.warn(`[PayPal Webhook] No matching booking found for capture ${captureId} / custom ${customId}`);
      }
    }

    // 4. Mark WebhookEvent as successfully PROCESSED
    await WebhookEvent.updateOne(
      { eventId: event.id },
      {
        $set: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
      }
    );

    return res.status(200).json({ received: true, eventId: event.id });
  } catch (err) {
    console.error(`[PayPal Webhook] Processing error for event ${event.id}:`, err.message);

    // Fail record so PayPal retry can be re-evaluated
    await WebhookEvent.updateOne(
      { eventId: event.id },
      {
        $set: {
          status: "FAILED",
          lastError: err.message,
        },
      }
    );

    return res.status(500).json({ message: "Failed to process webhook event" });
  }
}
