import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Booking } from "../models/Booking.js";

import { prepareBooking } from "../services/bookingService.js";

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
  booking.status = "cancelled";
  await booking.save();
  return res.json(booking);
}
