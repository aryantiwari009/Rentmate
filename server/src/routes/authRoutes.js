import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, register, me, logout } from "../controllers/authController.js";
import { requireAuth } from "../middleware/requireAuth.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication requests, please try again in 15 minutes." },
});

const router = Router();

router.post("/register", authLimiter, register); 
router.post("/login", authLimiter, login);
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;