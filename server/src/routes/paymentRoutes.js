import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import {
  getConfig,
  createOrder,
  capture,
  createInvoiceEndpoint,
  getInvoiceEndpoint,
  getInvoiceHistoryEndpoint,
  handleWebhook,
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
// Both POST /api/payments/webhook and POST /api/paypal/webhook are supported
router.post("/webhook", handlePayPalWebhook);

// Protected client endpoints
router.get("/config", requireAuth, getConfig);
router.post("/create-order", requireAuth, createOrder);
router.post("/capture", requireAuth, capture);
router.post("/create-invoice", requireAuth, createInvoiceEndpoint);
router.get("/invoice/:bookingId", requireAuth, getInvoiceEndpoint);
router.get("/history/:bookingId", requireAuth, getInvoiceHistoryEndpoint);

export default router;
