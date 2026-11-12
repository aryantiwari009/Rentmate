import { Router } from "express";
import { handlePayPalWebhook } from "../controllers/paypalWebhookController.js";

const router = Router();

// Endpoint: POST /api/paypal/webhook
router.post("/webhook", handlePayPalWebhook);

export default router;
