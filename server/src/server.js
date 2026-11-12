import express from "express";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.resolve(__dirname, "../../client/dist");

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import { connectDB } from "./config/db.js";
import productRoutes from "./routes/productRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import assistantRoutes from "./routes/assistantRoutes.js";
import paymentRoutes from "./routes/paymentRoutes.js";

const app = express();

app.set("trust proxy", 1);

app.use(express.json());
app.use(cookieParser());

const port = process.env.PORT || 5000;

app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, message: "RentMate is up and running" });
});

// everything in productRoutes lives under /api/products
app.use("/api/products", productRoutes);
// everything in authRoutes lives under /api/auth
app.use("/api/auth", authRoutes);
// everything in bookingRoutes lives under /api/bookings
app.use("/api/bookings", bookingRoutes);
// everything in assistantRoutes lives under /api/assistant
app.use("/api/assistant", assistantRoutes);
// payment routes live under /api/payments
app.use("/api/payments", paymentRoutes);

// Catch-all 404 for unknown API routes (always returns JSON, never index.html)
app.use("/api", (req, res) => {
  res.status(404).json({ message: "API endpoint not found" });
});

// Production: serve built client and handle client-side routing
if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && !req.path.startsWith("/api")) {
      return res.sendFile(path.join(clientDist, "index.html"));
    }
    next();
  });
}

// Final error-handling middleware (never logs secrets, returns JSON 500)
app.use((err, req, res, next) => {
  console.error(err.message);
  res.status(500).json({ message: "Server error" });
});

async function start() {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log("Server is up and Listening on PORT " + port);
    });
  } catch (error) {
    console.log(`Error : ${error.message}`);
    process.exit(1);
  }
}

export { app };
export default app;

start();