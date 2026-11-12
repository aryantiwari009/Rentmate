import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { Booking } from "../models/Booking.js";

// Checks a booking request and works out the real dates and money.
// It saves nothing. It returns { error } or { booking, product }.
export async function prepareBooking({ productId, startDate, months }) {
  const fail = (status, message) => ({ error: { status, message } });

  if (typeof productId !== "string" || !mongoose.isValidObjectId(productId)) {
    return fail(400, "Invalid product id");
  }
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    return fail(400, "months must be a whole number from 1 to 24");
  }
  if (typeof startDate !== "string") {
    return fail(400, "startDate must be a date like 2026-11-10");
  }

  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) {
    return fail(400, "startDate must be a valid date");
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start < today) {
    return fail(400, "startDate cannot be in the past");
  }

  const product = await Product.findById(productId);
  if (!product) return fail(404, "Product not found");
  if (!product.available) return fail(409, "This item is not available");

  const endDate = new Date(start);
  endDate.setMonth(endDate.getMonth() + months);

  const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
  const clash = await Booking.findOne({
    product: product._id,
    status: "active",
    startDate: { $lt: endDate },
    endDate: { $gt: start },
    $or: [
      { paymentStatus: "paid" },
      { paymentStatus: "pending", createdAt: { $gte: thirtyMinutesAgo } },
    ],
  });
  if (clash) return fail(409, "This item is already booked for those dates");

  const monthlyRent = product.price;
  const deposit = product.deposit;
  const total = monthlyRent * months + deposit;

  return {
    product,
    booking: {
      product: product._id,
      startDate: start,
      endDate,
      months,
      monthlyRent,
      deposit,
      total,
    },
  };
}