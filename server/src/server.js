import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { demoProducts } from "./data.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

const bookingSchema = new mongoose.Schema({
  productId: String,
  productName: String,
  startDate: String,
  months: Number,
  monthlyRent: Number,
  deposit: Number,
  total: Number,
  status: { type: String, default: "Active" },
  deliveryDate: String,
  location: String,
  createdAt: { type: Date, default: Date.now }
});
const Booking = mongoose.model("Booking", bookingSchema);

app.get("/api/health", (_, res) => res.json({ ok: true, message: "RentMate API running" }));

app.get("/api/products", (req, res) => {
  const q = (req.query.q || "").toLowerCase();
  const category = req.query.category || "All";
  const max = Number(req.query.max || 0);

  let result = demoProducts.filter(p => {
    const matchesQuery = !q || `${p.name} ${p.category} ${p.location}`.toLowerCase().includes(q);
    const matchesCategory = category === "All" || p.category === category;
    const matchesPrice = !max || p.price <= max;
    return matchesQuery && matchesCategory && matchesPrice;
  });

  res.json(result);
});

app.get("/api/products/:id", (req, res) => {
  const product = demoProducts.find(p => p._id === req.params.id);
  if (!product) return res.status(404).json({ message: "Product not found" });
  res.json(product);
});

function bookingOverlaps(existing, startDate, months) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + Number(months));
  const existingStart = new Date(existing.startDate);
  const existingEnd = new Date(existingStart);
  existingEnd.setMonth(existingEnd.getMonth() + Number(existing.months || 1));
  return start < existingEnd && end > existingStart;
}

app.get("/api/availability/:productId", async (req, res) => {
  const { productId } = req.params;
  const startDate = req.query.startDate;
  const months = Number(req.query.months || 1);
  if (!startDate) return res.status(400).json({ message: "startDate is required" });
  if (mongoose.connection.readyState === 1) {
    const bookings = await Booking.find({ productId, status: { $ne: "Returned" } });
    return res.json({ available: !bookings.some(b => bookingOverlaps(b, startDate, months)) });
  }
  res.json({ available: true, mode: "demo" });
});

app.post("/api/bookings", async (req, res) => {
  try {
    const booking = req.body;
    if (!booking.productId || !booking.startDate || !booking.months) return res.status(400).json({ message: "Missing booking details" });
    if (mongoose.connection.readyState === 1) {
      const existing = await Booking.find({ productId: booking.productId, status: { $ne: "Returned" } });
      if (existing.some(b => bookingOverlaps(b, booking.startDate, booking.months))) return res.status(409).json({ message: "This rental is already booked for part of those dates." });
      const saved = await Booking.create(booking);
      return res.status(201).json(saved);
    }
    res.status(201).json({ ...booking, _id: `demo-${Date.now()}`, status: "Confirmed" });
  } catch {
    res.status(500).json({ message: "Could not create booking" });
  }
});

app.get("/api/bookings", async (_, res) => {
  if (mongoose.connection.readyState === 1) {
    const bookings = await Booking.find().sort({ createdAt: -1 });
    return res.json(bookings);
  }
  res.json([]);
});

app.post("/api/ai/recommend", async (req, res) => {
  const request = req.body.request || req.body.query;
  if (!request) return res.status(400).json({ message: "Tell us what you need." });

  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    const text = request.toLowerCase();
    const picks = demoProducts.filter(p =>
      (text.includes("work") && p.category === "Work & Study") ||
      (text.includes("home") && ["Furniture", "Home Essentials"].includes(p.category)) ||
      (text.includes("study") && p.category === "Work & Study") ||
      (text.includes("office") && p.category === "Work & Study")
    );
    const fallback = picks.length ? picks : demoProducts.slice(0, 3);
    const budgetMatch = request.match(/(?:₹|rs\.?|inr)?\s*(\d{3,6})/i);
    const budget = budgetMatch ? Number(budgetMatch[1]) : null;
    const withinBudget = budget ? fallback.filter(p => p.price <= budget) : fallback;
    const recommendations = (withinBudget.length ? withinBudget : fallback).slice(0, 4);
    return res.json({
      source: "demo",
      answer: budget && recommendations.reduce((sum, p) => sum + p.price, 0) > budget
        ? `I found options for your needs, but the combined setup is above your ₹${budget}/month budget.`
        : `I found ${recommendations.length} rental options based on your requirement${budget ? ` within ₹${budget}/month where possible` : ""}.`,
      recommendations
    });
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: "You are RentMate's rental assistant. Recommend practical rental bundles from the supplied catalog. Be concise and budget-aware." },
          { role: "user", content: `User need: ${request}\nCatalog: ${JSON.stringify(demoProducts.map(({_id,name,category,price}) => ({_id,name,category,price})))}\nReturn a concise recommendation.` }
        ]
      })
    });
    const data = await response.json();
    res.json({ source: "ai", answer: data.choices?.[0]?.message?.content || "No recommendation generated." });
  } catch {
    res.status(500).json({ message: "AI service unavailable" });
  }
});

mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/rentmate")
  .then(() => console.log("MongoDB connected"))
  .catch(() => console.log("MongoDB unavailable — running in demo mode"));

app.listen(PORT, () => console.log(`RentMate API running on http://localhost:${PORT}`));