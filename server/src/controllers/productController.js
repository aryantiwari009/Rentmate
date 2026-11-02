import mongoose from "mongoose";
import { Product } from "../models/Product.js";

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function getProducts(req, res) {
  const filter = {};

  const maxPrice = Number(req.query.maxPrice);
  if (req.query.maxPrice && !Number.isNaN(maxPrice)) {
    filter.price = { $lte: maxPrice };
  }

  const { category } = req.query;
  if (typeof category === "string" && category.trim() !== "") {
    filter.category = {
      $regex: `^${escapeRegex(category.trim())}$`,
      $options: "i",
    };
  }

  const { q } = req.query;
  if (typeof q === "string" && q.trim() !== "") {
    const safe = escapeRegex(q.trim());
    filter.$or = [
      { name: { $regex: safe, $options: "i" } },
      { description: { $regex: safe, $options: "i" } },
    ];
  }

  if (req.query.available === "true") {
    filter.available = true;
  }

  const products = await Product.find(filter);
  res.json(products);
}

export async function getProductsById(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    return res.status(400).json({ message: "Invalid ID format" });
  }
  const product = await Product.findById(req.params.id);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  } else {
    return res.status(200).json({ product });
  }
}
