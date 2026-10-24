import mongoose from "mongoose";
import { Product } from "../models/Product.js";
import { connectDB } from "../config/db.js";
import { productsData } from "./productsData.js";

async function seed() {
  try {
    await connectDB();
    const count = await Product.countDocuments();

    if (count === 0) {
      const savedItems = await Product.insertMany(productsData);
      console.log(`${savedItems.length} Products were saved`)
    }else{
        console.log("Products are already available");
    }
  } catch (err) {
    console.log(`Error : ${err.message}`);
  } finally {
    await mongoose.disconnect();
  }
}

seed();