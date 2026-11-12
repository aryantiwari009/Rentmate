import mongoose from "mongoose";
import { Booking } from "../models/Booking.js";
import { createOrder as paypalCreateOrder, captureOrder as paypalCaptureOrder } from "../services/paypal.js";

export function getConfig(req, res) {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  if (!clientId) {
    return res.status(500).json({ message: "PayPal is not configured: PAYPAL_CLIENT_ID is missing" });
  }
  const currency = process.env.PAYPAL_CURRENCY || "USD";
  const inrPerUsd = Number(process.env.INR_PER_USD) || 85;

  return res.json({
    clientId,
    currency,
    inrPerUsd,
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

  // Amount is ALWAYS computed on the server from booking.total in the database divided by INR_PER_USD
  const inrPerUsd = Number(process.env.INR_PER_USD) || 85;
  const currency = process.env.PAYPAL_CURRENCY || "USD";
  const amount = (booking.total / inrPerUsd).toFixed(2);

  try {
    const order = await paypalCreateOrder({
      amount,
      currency,
      bookingId: booking._id.toString(),
      description: `RentMate Booking #${booking._id}`,
    });

    booking.paypalOrderId = order.id;
    await booking.save();

    return res.json({ orderId: order.id });
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

  const inrPerUsd = Number(process.env.INR_PER_USD) || 85;
  const expectedCurrency = process.env.PAYPAL_CURRENCY || "USD";
  const expectedAmount = (booking.total / inrPerUsd).toFixed(2);

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
  await booking.save();

  return res.json(booking);
}
