import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Booking } from "../models/Booking.js";

import { prepareBooking } from "../services/bookingService.js";
import { refundCapture, getOrder } from "../services/paypal.js";

export async function createBooking(req, res) {
  const { productId, startDate, months } = req.body;

  const result = await prepareBooking({ productId, startDate, months });
  if (result.error) {
    return res.status(result.error.status).json({ message: result.error.message });
  }

  const booking = await Booking.create({ user: req.user._id, ...result.booking });
  return res.status(201).json(booking);
}

export async function getBooking(req, res) {
  if (mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Booking not Found" });
  }

  const bookings = await Booking.find({ user: req.user._id })
    .populate("product", "name image location")
    .sort({ createdAt: -1 });

  return res.json(bookings);
}

export async function cancelBooking(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Not a valid id" });
  }

  const booking = await Booking.findOne({
    _id: req.params.id,
    user: req.user._id,
  });

  if (!booking) {
    return res.status(404).json({ message: "Booking not Found" });
  }
  if (booking.status !== "active") {
    return res
      .status(409)
      .json({ message: "Only active bookings can be cancelled" });
  }

  let refundIssued = false;
  if (booking.paymentStatus === "paid") {
    try {
      let captureId = booking.paypalCaptureId;
      if (!captureId && booking.paypalOrderId) {
        const orderData = await getOrder(booking.paypalOrderId);
        captureId = orderData?.purchase_units?.[0]?.payments?.captures?.[0]?.id;
      }

      if (captureId) {
        await refundCapture(captureId, `Refund for cancelled RentMate booking #${booking._id}`);
        booking.paypalCaptureId = captureId;
        booking.paymentStatus = "refunded";
        booking.refundedAt = new Date();
        refundIssued = true;
      }
    } catch (err) {
      console.error(`Refund failed for booking ${booking._id}: ${err.message}`);
      return res.status(502).json({
        message: `Failed to process refund: ${err.message}. Booking was not cancelled.`,
      });
    }
  }

  booking.status = "cancelled";
  await booking.save();
  return res.json({ ...booking.toObject(), refundIssued });
}
