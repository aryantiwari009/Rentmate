import express from "express";
import {connectDB} from "./config/db.js";
import productRoutes from "./routes/productRoutes.js"
import authRoutes from './routes/authRoutes.js'
import cookieParser from "cookie-parser";
import "dotenv/config";
import bookingRoutes from './routes/bookingRoutes.js'
import assistantRoutes from "./routes/assistantRoutes.js";

const app = express();

app.use(express.json());
app.use(cookieParser());

const port = process.env.PORT || 5000;

app.get("/api/health", (req, res) => {
  res.status(200).json({ ok: true, message: "RentMate is up and running" });
});

async function start() {
  try {
    await connectDB();

    app.listen(port, () => {
      console.log("Server is up and Listening on PORT" + " " + port);
    });
  } catch(error) {
    console.log(`Error : ${error.message}`)
    process.exit(1);
  }
}

// everything in productRoutes lives under /api/products
app.use('/api/products', productRoutes);
// everything in authRoutes lives under /api/auth
app.use("/api/auth", authRoutes);
// everything in authRoutes lives under /api/booking
app.use("/api/bookings", bookingRoutes);
// everything in authRoutes lives under /api/assistant
app.use("/api/assistant", assistantRoutes);

start();