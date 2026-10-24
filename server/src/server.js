import express from "express";
import {connectDB} from "./config/db.js";
import productRoutes from "./routes/productRoutes.js"
import "dotenv/config";

const app = express();

app.use(express.json());

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

// everything in bookRoutes lives under /api/books
app.use('/api/products', productRoutes);
app.use('/api/products/:id', productRoutes);

start();