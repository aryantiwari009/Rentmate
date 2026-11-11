import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { chat } from "../controllers/assistantController.js";

const limiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please wait a minute." },
});

const router = Router();
router.post("/chat", limiter, requireAuth, chat);

export default router;