import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId, /*says this field holds a MongoDB id, not text. With String, any text would be accepted, including "banana". With ObjectId, Mongoose rejects anything that isn’t a valid id.*/
      ref: "User", //says which collection that id belongs to.
      required: true,
    },
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    startDate: { type: Date, required: true },
    months: {
      type: Number,
      required: true,
      min: 1,
      max: 24,
      validate: { //function that receives the value and returns true (fine) or false
        validator: Number.isInteger,
        message: "months must be a whole number",
      },
    },
    monthlyRent: { type: Number, required: true, min: 0 },
    deposit: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["active", "returned", "cancelled"],
      default: "active",
    },
    endDate: { type: Date, required: true }
  },
  { timestamps: true }
);

export const Booking = mongoose.model("Booking", bookingSchema);