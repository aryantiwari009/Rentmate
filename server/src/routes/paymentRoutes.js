import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getConfig,
  createOrder,
  capture,
  createInvoiceEndpoint,
  getInvoiceEndpoint,
} from "../controllers/paymentController.js";
import { handlePayPalWebhook } from "../controllers/paypalWebhookController.js";

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment requests. Please wait a minute." },
});

const router = Router();

router.use(paymentLimiter);

// PayPal Webhooks (called asynchronously by PayPal servers)
router.post("/webhook", handleWebhook);

// Protected client endpoints
router.get("/config", requireAuth, getConfig);
router.post("/create-order", requireAuth, createOrder);
router.post("/capture", requireAuth, capture);
router.post("/create-invoice", requireAuth, createInvoiceEndpoint);
router.get("/invoice/:bookingId", requireAuth, getInvoiceEndpoint);

export default router;
