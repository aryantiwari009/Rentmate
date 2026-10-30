import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Booking } from "../models/Booking.js";

export async function createBooking(req, res) {
  const { startDate, months, productId } = req.body;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!mongoose.isValidObjectId(productId)) {
    return res
      .status(400)
      .json({ message: "ProductId is not in the right format" });
  }
  const product = await Product.findById(productId);

  if (!product) {
    return res.status(401).json({ message: "Product not Found" });
  }

  if (!Number.isInteger(months) || months < 0 || months > 12) {
    return res.status(400).json({
      message:
        "Months can not be whole number, and should be in range from 0 to 12",
    });
  }
  if (typeof startDate !== "string") {
    return res.status(400).json({ message: "Not a Valid Date, Format - YYYY-MM-DD" });
  }
  const start = new Date(startDate);
  // isNaN(start.getTime()) returns true if the date is INVALID
  if (isNaN(start.getTime()) || start < today) {
    return res.status(400).json({ message: "Must be a Valid Date" });
  }

  if (!product.available) {
    return res.status(409).json({ message: "Product not Available" });
  }

  const monthlyRent = product.price;
  const deposit = product.deposit;
  const total = monthlyRent * months + deposit;

  const booking = await Booking.create({
    user: req.user._id,
    product: product._id,
    startDate: start,
    months,
    monthlyRent,
    deposit,
    total,
  });

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
