import { Booking } from "./src/models/Booking.js";

export async function test(req,res) {
  try {
    const booking = new Booking({
      user: "507f1f77bcf86cd799439011",
      product: "507f1f77bcf86cd799439011",
      startDate: "2026-01-01",
      months: 2,
      monthlyRent: 700,
      deposit: 1000,
      status: "paused",
      total: 1700,
    });

    await booking.validate();
    console.log("Valid", booking.status);
  } catch(err) {
    console.log(err.message);
  }
}

test();