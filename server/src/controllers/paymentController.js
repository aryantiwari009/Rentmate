import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { Invoice } from "../models/Invoice.js";
import { handlePayPalWebhook } from "./paypalWebhookController.js";
import {
  createOrder as paypalCreateOrder,
  captureOrder as paypalCaptureOrder,
  getOrder as paypalGetOrder,
  createInvoice as paypalCreateInvoice,
  sendInvoice as paypalSendInvoice,
  getInvoice as paypalGetInvoice,
  recordInvoicePayment,
} from "../services/paypal.js";
import { calculateBookingBreakdown, getCurrencyConfig } from "../utils/currency.js";

export function getConfig(req, res) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ message: "PayPal is not configured: PAYPAL_CLIENT_ID is missing" });
  }
  const { inrPerUsd, currency } = getCurrencyConfig();

  return res.json({
    clientId,
    currency,
    inrPerUsd,
    baseCurrency: "INR",
  });
}

export async function createOrder(req, res) {
  const { bookingId } = req.body;

  if (!bookingId || typeof bookingId !== "string" || !mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: "Valid bookingId is required" });
  }

  // Look up booking owned by req.user._id; return 404 for anyone else's booking
  const booking = await Booking.findOne({
    _id: bookingId,
    user: req.user._id,
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  // Creating an order for a booking that is not status "active" and paymentStatus "pending" returns 409
  if (booking.status !== "active" || booking.paymentStatus !== "pending") {
    return res.status(409).json({ message: "Booking is not eligible for payment" });
  }

  // Compute breakdown and lock conversion values on booking
  const breakdown = calculateBookingBreakdown(booking);
  const amount = breakdown.totalTarget.toFixed(2);
  const currency = breakdown.currency;

  try {
    const order = await paypalCreateOrder({
      amount,
      currency,
      bookingId: booking._id.toString(),
      description: `RentMate Booking #${booking._id}`,
    });

    booking.paypalOrderId = order.id;
    booking.exchangeRate = breakdown.conversionRate;
    booking.chargedAmount = breakdown.totalTarget;
    booking.chargedCurrency = currency;
    await booking.save();

    return res.json({
      orderId: order.id,
      amount,
      currency,
      exchangeRate: breakdown.conversionRate,
      originalAmount: booking.total,
      originalCurrency: booking.currency || "INR",
    });
  } catch (err) {
    console.error(`create-order failed for booking ${booking._id}: ${err.message}`);
    return res.status(500).json({ message: err.message || "Failed to create payment order" });
  }
}

export async function capture(req, res) {
  const { orderId } = req.body;

  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ message: "orderId is required" });
  }

  // Find the booking by paypalOrderId and user
  const booking = await Booking.findOne({
    paypalOrderId: orderId,
    user: req.user._id,
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  // Idempotent: capturing an already paid booking returns 200 with the booking and does not charge twice
  if (booking.paymentStatus === "paid") {
    return res.status(200).json(booking);
  }

  if (booking.status !== "active") {
    return res.status(409).json({ message: "Only active bookings can be paid" });
  }

  const breakdown = calculateBookingBreakdown(
    booking,
    booking.exchangeRate,
    booking.chargedCurrency
  );
  const expectedAmount = (
    booking.chargedAmount !== undefined && booking.chargedAmount !== null
      ? booking.chargedAmount
      : breakdown.totalTarget
  ).toFixed(2);
  const expectedCurrency = booking.chargedCurrency || breakdown.currency;

  let captureData;
  try {
    captureData = await paypalCaptureOrder(orderId);
  } catch (err) {
    if (err.issue === "ORDER_ALREADY_CAPTURED") {
      const reloaded = await Booking.findById(booking._id);
      if (reloaded && reloaded.paymentStatus === "paid") {
        return res.status(200).json(reloaded);
      }
    }
    console.error(`capture failed for order ${orderId}: ${err.message}`);
    return res.status(502).json({ message: "Failed to capture payment with PayPal" });
  }

  // Verification
  const unit = captureData.purchase_units?.[0];
  const captureObj = unit?.payments?.captures?.[0];

  const statusCompleted = captureData.status === "COMPLETED" || captureObj?.status === "COMPLETED";
  const capturedAmount = captureObj?.amount?.value;
  const capturedCurrency = captureObj?.amount?.currency_code;
  const bookingRefMatch =
    unit?.reference_id === booking._id.toString() ||
    captureObj?.custom_id === booking._id.toString() ||
    unit?.custom_id === booking._id.toString() ||
    captureData.id === booking.paypalOrderId;

  const amountMatch = capturedAmount && Number(capturedAmount) === Number(expectedAmount);
  const currencyMatch = capturedCurrency === expectedCurrency;

  if (!statusCompleted || !amountMatch || !currencyMatch || !bookingRefMatch) {
    console.error(
      `Payment verification mismatch for booking ${booking._id}: status=${statusCompleted}, amount=${amountMatch}, currency=${currencyMatch}, ref=${bookingRefMatch}`
    );
    return res.status(400).json({ message: "Payment verification failed" });
  }

  // Only the server sets paymentStatus to "paid" (and paidAt)
  booking.paymentStatus = "paid";
  booking.paidAt = new Date();
  if (captureObj?.id) {
    booking.paypalCaptureId = captureObj.id;
  }

  // If this booking has an existing PayPal invoice, record payment on it so PayPal invoice becomes PAID
  if (booking.paypalInvoiceId) {
    try {
      await recordInvoicePayment(booking.paypalInvoiceId, {
        amount: Number(expectedAmount),
        currency: expectedCurrency,
        paymentDate: booking.paidAt,
        note: `Paid via PayPal Checkout (Capture ID: ${captureObj?.id || "captured"})`,
        method: "PAYPAL",
        paymentId: captureObj?.id,
      });
      booking.paypalInvoiceStatus = "PAID";
      await Invoice.updateOne(
        { invoiceId: booking.paypalInvoiceId },
        {
          $set: {
            status: "PAID",
            paidAt: booking.paidAt,
          },
          $push: {
            eventHistory: {
              eventType: "PAYMENT.CAPTURE.COMPLETED",
              timestamp: new Date(),
              summary: `Paid via PayPal Checkout (Capture ${captureObj?.id}) and recorded on invoice`,
            },
          },
        }
      );
    } catch (invErr) {
      console.warn(`Sync payment on invoice ${booking.paypalInvoiceId} failed: ${invErr.message}`);
    }
  }

  await booking.save();

  return res.json(booking);
}

function resolvePayerUrl(invoiceData, invoiceId) {
  if (invoiceData?.detail?.metadata?.recipient_view_url) {
    return invoiceData.detail.metadata.recipient_view_url;
  }
  if (invoiceData?.detail?.metadata?.payer_view_url) {
    return invoiceData.detail.metadata.payer_view_url;
  }
  const link = invoiceData?.links?.find(
    (l) => l.rel === "payer-view" || l.rel === "payer_view"
  );
  if (link?.href) return link.href;

  const isSandbox = (process.env.PAYPAL_API || "").includes("sandbox");
  const host = isSandbox ? "https://www.sandbox.paypal.com" : "https://www.paypal.com";
  return `${host}/invoice/p/#${invoiceId}`;
}

export async function createInvoiceEndpoint(req, res) {
  const { bookingId, note } = req.body;

  if (!bookingId || typeof bookingId !== "string" || !mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: "Valid bookingId is required" });
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    user: req.user._id,
  }).populate("product");

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (booking.status !== "active") {
    return res.status(409).json({ message: "Invoices can only be created for active bookings" });
  }

  const breakdown = calculateBookingBreakdown(
    booking,
    booking.exchangeRate,
    booking.chargedCurrency
  );
  const targetAmount = breakdown.totalTarget;
  const currency = breakdown.currency;
  const isAlreadyPaid = booking.paymentStatus === "paid";

  // If already generated
  if (booking.paypalInvoiceId && booking.paypalInvoiceUrl) {
    let freshInvoiceUrl = booking.paypalInvoiceUrl;
    // If the booking is paid, make sure the invoice reflects PAID on PayPal and in DB
    if (isAlreadyPaid) {
      try {
        await recordInvoicePayment(booking.paypalInvoiceId, {
          amount: targetAmount,
          currency,
          paymentDate: booking.paidAt || new Date(),
          note: `Paid via PayPal Checkout (Capture ID: ${booking.paypalCaptureId || "captured"})`,
          method: "PAYPAL",
          paymentId: booking.paypalCaptureId,
        });
        booking.paypalInvoiceStatus = "PAID";
        booking.paypalInvoiceAmount = targetAmount;
        booking.paypalInvoiceCurrency = currency;

        const detailedPaid = await paypalGetInvoice(booking.paypalInvoiceId);
        if (detailedPaid) {
          freshInvoiceUrl = resolvePayerUrl(detailedPaid, booking.paypalInvoiceId);
          booking.paypalInvoiceUrl = freshInvoiceUrl;
        }

        await booking.save();
        await Invoice.updateOne(
          { invoiceId: booking.paypalInvoiceId },
          {
            $set: {
              status: "PAID",
              paidAt: booking.paidAt || new Date(),
              amount: targetAmount,
              currency,
              originalAmount: booking.total,
              originalCurrency: booking.currency || "INR",
              exchangeRate: breakdown.conversionRate,
              invoiceUrl: freshInvoiceUrl,
            },
            $push: {
              eventHistory: {
                eventType: "PAYMENT.CAPTURE.COMPLETED",
                timestamp: new Date(),
                summary: `Invoice synchronized to PAID following Checkout capture (${booking.paypalCaptureId || "N/A"})`,
              },
            },
          }
        );
      } catch (err) {
        console.warn(`Sync payment on existing invoice ${booking.paypalInvoiceId} failed: ${err.message}`);
      }
    }

    return res.json({
      invoiceId: booking.paypalInvoiceId,
      invoiceUrl: freshInvoiceUrl,
      status: booking.paypalInvoiceStatus || (isAlreadyPaid ? "PAID" : "SENT"),
      amount: targetAmount,
      currency,
      exchangeRate: breakdown.conversionRate,
      alreadyCreated: true,
      isPaidReceipt: isAlreadyPaid,
    });
  }

  try {
    const created = await paypalCreateInvoice({
      booking,
      recipientEmail: req.user.email,
      recipientName: req.user.name,
      note: note || `RentMate Rental Invoice for ${booking.product?.name || "booking"}`,
    });

    const invoiceId = created.id;
    let invoiceUrl = resolvePayerUrl(created, invoiceId);

    // Send the invoice via PayPal notification
    try {
      await paypalSendInvoice(invoiceId);
      const detailed = await paypalGetInvoice(invoiceId);
      if (detailed) {
        invoiceUrl = resolvePayerUrl(detailed, invoiceId);
      }
    } catch (sendErr) {
      console.warn(`Invoice send warning for ${invoiceId}:`, sendErr.message);
    }

    let finalStatus = "SENT";

    // If booking is ALREADY PAID, immediately record payment to transform invoice into a paid receipt
    if (isAlreadyPaid) {
      try {
        await recordInvoicePayment(invoiceId, {
          amount: targetAmount,
          currency,
          paymentDate: booking.paidAt || new Date(),
          note: `Paid via PayPal Checkout (Capture ID: ${booking.paypalCaptureId || "captured"})`,
          method: "PAYPAL",
          paymentId: booking.paypalCaptureId,
        });
        finalStatus = "PAID";

        const detailedPaid = await paypalGetInvoice(invoiceId);
        if (detailedPaid) {
          invoiceUrl = resolvePayerUrl(detailedPaid, invoiceId);
        }
      } catch (recErr) {
        console.warn(`Failed to record payment on new invoice ${invoiceId}:`, recErr.message);
      }
    }

    booking.paypalInvoiceId = invoiceId;
    booking.paypalInvoiceUrl = invoiceUrl;
    booking.paypalInvoiceStatus = finalStatus;
    booking.paypalInvoiceAmount = targetAmount;
    booking.paypalInvoiceCurrency = currency;
    booking.exchangeRate = booking.exchangeRate || breakdown.conversionRate;
    booking.chargedAmount = booking.chargedAmount || targetAmount;
    booking.chargedCurrency = booking.chargedCurrency || currency;
    await booking.save();

    await Invoice.findOneAndUpdate(
      { invoiceId },
      {
        $set: {
          invoiceId,
          booking: booking._id,
          user: req.user._id,
          status: finalStatus,
          amount: targetAmount,
          currency,
          originalAmount: booking.total,
          originalCurrency: booking.currency || "INR",
          exchangeRate: breakdown.conversionRate,
          invoiceUrl,
          recipientEmail: req.user.email,
          recipientName: req.user.name,
          note: note || `RentMate Rental Invoice for ${booking.product?.name || "booking"}`,
          rawDetails: created,
          ...(finalStatus === "PAID" ? { paidAt: booking.paidAt || new Date() } : {}),
        },
        $push: {
          eventHistory: {
            eventType: finalStatus === "PAID" ? "PAYMENT.CAPTURE.COMPLETED" : "INVOICING.INVOICE.SENT",
            timestamp: new Date(),
            summary:
              finalStatus === "PAID"
                ? `Created paid rental invoice/receipt for settled booking (Capture ${booking.paypalCaptureId || "captured"})`
                : "Created and sent payable invoice",
          },
        },
      },
      { upsert: true, new: true }
    );

    return res.json({
      invoiceId,
      invoiceUrl,
      status: finalStatus,
      amount: targetAmount,
      currency,
      exchangeRate: breakdown.conversionRate,
      isPaidReceipt: finalStatus === "PAID",
    });
  } catch (err) {
    console.error(`create-invoice failed for booking ${booking._id}:`, err.message);
    const isPermissionError =
      err.message?.toLowerCase().includes("permission") ||
      err.message?.toLowerCase().includes("authorization failed");
    const message = isPermissionError
      ? "PayPal Invoicing permission is not enabled on your PayPal Developer App. In your PayPal Developer Dashboard (Apps & Credentials), select your App and enable 'Invoicing' under App Feature Options."
      : err.message || "Failed to create PayPal invoice";
    return res.status(500).json({ message });
  }
}

export async function getInvoiceHistoryEndpoint(req, res) {
  const { bookingId } = req.params;

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: "Valid bookingId is required" });
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    user: req.user._id,
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  const breakdown = calculateBookingBreakdown(
    booking,
    booking.exchangeRate,
    booking.chargedCurrency
  );
  const invoice = await Invoice.findOne({ booking: bookingId });

  return res.json({
    bookingId: booking._id,
    paymentStatus: booking.paymentStatus,
    paidAt: booking.paidAt,
    originalAmount: booking.total,
    originalCurrency: booking.currency || "INR",
    exchangeRate: booking.exchangeRate || breakdown.conversionRate,
    chargedAmount: booking.chargedAmount || breakdown.totalTarget,
    chargedCurrency: booking.chargedCurrency || breakdown.currency,
    paypalOrderId: booking.paypalOrderId,
    paypalCaptureId: booking.paypalCaptureId,
    invoiceId: booking.paypalInvoiceId || invoice?.invoiceId,
    invoiceUrl: booking.paypalInvoiceUrl || invoice?.invoiceUrl,
    invoiceStatus: booking.paypalInvoiceStatus || invoice?.status,
    invoiceAmount:
      booking.paypalInvoiceAmount || invoice?.amount || breakdown.totalTarget,
    invoiceCurrency:
      booking.paypalInvoiceCurrency || invoice?.currency || breakdown.currency,
    events: invoice?.eventHistory || [],
  });
}

export async function getInvoiceEndpoint(req, res) {
  const { bookingId } = req.params;

  if (!bookingId || !mongoose.isValidObjectId(bookingId)) {
    return res.status(400).json({ message: "Valid bookingId is required" });
  }

  const booking = await Booking.findOne({
    _id: bookingId,
    user: req.user._id,
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not found" });
  }

  if (!booking.paypalInvoiceId) {
    return res.status(404).json({ message: "No PayPal invoice associated with this booking" });
  }

  try {
    let invoice = await paypalGetInvoice(booking.paypalInvoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found on PayPal" });
    }

    const breakdown = calculateBookingBreakdown(
      booking,
      booking.exchangeRate,
      booking.chargedCurrency
    );

    if (booking.paymentStatus === "paid" && invoice.status !== "PAID") {
      try {
        const usdAmount = breakdown.totalTarget;
        await recordInvoicePayment(booking.paypalInvoiceId, {
          amount: usdAmount,
          currency: breakdown.currency,
          paymentDate: booking.paidAt || new Date(),
          note: `Paid via PayPal Checkout (Capture ID: ${booking.paypalCaptureId || "captured"})`,
          method: "PAYPAL",
          paymentId: booking.paypalCaptureId,
        });
        invoice = await paypalGetInvoice(booking.paypalInvoiceId);
        booking.paypalInvoiceStatus = "PAID";
        booking.paypalInvoiceAmount = usdAmount;
        booking.paypalInvoiceCurrency = breakdown.currency;
        await booking.save();
        await Invoice.updateOne(
          { invoiceId: booking.paypalInvoiceId },
          {
            $set: {
              status: "PAID",
              paidAt: booking.paidAt || new Date(),
              amount: usdAmount,
              currency: breakdown.currency,
            },
          }
        );
      } catch (syncErr) {
        console.warn(`Sync payment on getInvoice failed: ${syncErr.message}`);
      }
    }

    const invoiceUrl = resolvePayerUrl(invoice, booking.paypalInvoiceId);
    return res.json({ invoice, invoiceUrl });
  } catch (err) {
    console.error(`get-invoice failed for booking ${bookingId}:`, err.message);
    return res.status(500).json({ message: "Failed to retrieve invoice" });
  }
}

export async function handleWebhook(req, res) {
  return handlePayPalWebhook(req, res);
}
