import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { getConfig, createOrder, capture } from "../controllers/paymentController.js";

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many payment requests. Please wait a minute." },
});

const router = Router();

router.use(paymentLimiter);
router.use(requireAuth);

router.get("/config", getConfig);
router.post("/create-order", createOrder);
router.post("/capture", capture);

export default router;
