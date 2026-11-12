import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Invoice } from "../models/Invoice.js";
import { WebhookEvent } from "../models/WebhookEvent.js";
import { verifyWebhookSignature } from "../services/paypal.js";

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

  // 2. Prevent duplicate processing
  const existingEvent = await WebhookEvent.findOne({ eventId: event.id });
  if (existingEvent) {
    console.log(`[PayPal Webhook] Duplicate event ${event.id} received. Skipping.`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  // 3. Verify PayPal Webhook Signature using official PayPal API
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
    return res.status(400).json({
      message: "Webhook signature verification failed",
      error: verification.error || "Invalid signature",
    });
  }

  const eventType = event.event_type;
  const resource = event.resource || {};
  console.log(`[PayPal Webhook] Verified event ${eventType} (${event.id})`);

  try {
    // ------------------------------------------------------------------------
    // INVOICE EVENTS: CREATED, SENT, PAID, CANCELLED, UPDATED
    // ------------------------------------------------------------------------
    if (eventType.startsWith("INVOICING.INVOICE.")) {
      const invoiceObj = resource.invoice || resource;
      const invoiceId = invoiceObj.id;

      if (invoiceId) {
        let invoiceStatus = "CREATED";
        if (eventType === "INVOICING.INVOICE.CREATED") {
          invoiceStatus = "CREATED";
        } else if (eventType === "INVOICING.INVOICE.SENT") {
          invoiceStatus = "SENT";
        } else if (eventType === "INVOICING.INVOICE.PAID") {
          invoiceStatus = "PAID";
        } else if (eventType === "INVOICING.INVOICE.CANCELLED") {
          invoiceStatus = "CANCELLED";
        } else if (eventType === "INVOICING.INVOICE.UPDATED") {
          invoiceStatus = "UPDATED";
        }

        const invoiceUrl = resolvePayerUrl(invoiceObj, invoiceId);
        const invoiceAmount = Number(
          invoiceObj.amount?.value || invoiceObj.detail?.payment_term?.due_amount?.value || 0
        );

        // Update or create MongoDB Invoice record
        const invoiceDoc = await Invoice.findOneAndUpdate(
          { invoiceId },
          {
            $set: {
              status: invoiceStatus,
              invoiceNumber: invoiceObj.detail?.invoice_number,
              amount: invoiceAmount || undefined,
              currency: invoiceObj.amount?.currency_code || invoiceObj.detail?.currency_code || "USD",
              invoiceUrl,
              rawDetails: invoiceObj,
              ...(invoiceStatus === "PAID" ? { paidAt: new Date() } : {}),
              ...(invoiceStatus === "CANCELLED" ? { cancelledAt: new Date() } : {}),
            },
          },
          { new: true, upsert: true }
        );

        // Update associated MongoDB Booking record
        const booking = await Booking.findOne({ paypalInvoiceId: invoiceId });
        if (booking) {
          booking.paypalInvoiceStatus = invoiceStatus;
          if (invoiceUrl && !booking.paypalInvoiceUrl) {
            booking.paypalInvoiceUrl = invoiceUrl;
          }

          if (invoiceStatus === "PAID") {
            booking.paymentStatus = "paid";
            booking.paidAt = booking.paidAt || new Date();
          } else if (invoiceStatus === "CANCELLED") {
            // Keep booking payment status in sync if cancelled before payment
            if (booking.paymentStatus === "pending") {
              booking.paypalInvoiceStatus = "CANCELLED";
            }
          }

          await booking.save();
          if (!invoiceDoc.booking) {
            invoiceDoc.booking = booking._id;
            invoiceDoc.user = booking.user;
            await invoiceDoc.save();
          }
          console.log(`[PayPal Webhook] Updated booking ${booking._id} for invoice ${invoiceId} -> ${invoiceStatus}`);
        }
      }
    }

    // ------------------------------------------------------------------------
    // PAYMENT EVENTS: COMPLETED, PENDING, DENIED
    // ------------------------------------------------------------------------
    else if (eventType.startsWith("PAYMENT.CAPTURE.")) {
      const captureId = resource.id;
      const customId = resource.custom_id || resource.reference_id;
      const orderId =
        resource.supplementary_data?.related_ids?.order_id ||
        resource.parent_payment;

      // Find booking by custom_id, captureId, or orderId
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
        if (captureId && !booking.paypalCaptureId) {
          booking.paypalCaptureId = captureId;
        }

        if (eventType === "PAYMENT.CAPTURE.COMPLETED") {
          booking.paymentStatus = "paid";
          booking.paidAt = booking.paidAt || new Date();
          console.log(`[PayPal Webhook] Booking ${booking._id} marked PAID via capture ${captureId}`);
        } else if (eventType === "PAYMENT.CAPTURE.PENDING") {
          booking.paymentStatus = "pending";
          console.log(`[PayPal Webhook] Booking ${booking._id} marked PENDING via capture ${captureId}`);
        } else if (eventType === "PAYMENT.CAPTURE.DENIED") {
          booking.paymentStatus = "failed";
          console.log(`[PayPal Webhook] Booking ${booking._id} marked FAILED (DENIED) via capture ${captureId}`);
        }

        await booking.save();
      } else {
        console.warn(`[PayPal Webhook] No matching booking found for capture ${captureId} / custom ${customId}`);
      }
    }

    // 4. Store Webhook Event in MongoDB for auditing and idempotency
    await WebhookEvent.create({
      eventId: event.id,
      eventType: event.event_type,
      resourceId: resource.id,
      resourceType: event.resource_type,
      summary: event.summary,
      status: "PROCESSED",
      payload: event,
      processedAt: new Date(),
    });

    return res.status(200).json({ received: true, eventId: event.id });
  } catch (err) {
    console.error(`[PayPal Webhook] Processing error for event ${event.id}:`, err.message);

    // Record failed event attempt so we have audit history
    try {
      await WebhookEvent.create({
        eventId: event.id,
        eventType: event.event_type,
        resourceId: resource.id,
        resourceType: event.resource_type,
        summary: event.summary,
        status: "FAILED",
        payload: event,
        processedAt: new Date(),
      });
    } catch (_) {}

    return res.status(500).json({ message: "Failed to process webhook event" });
  }
}
