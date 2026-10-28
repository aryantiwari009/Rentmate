import { Router } from 'express'
import { login, register, me, logout } from '../controllers/authController.js'
import { requireAuth } from '../middleware/requireAuth.js';

const router = Router();
// "/" here means the base path chosen in server.js
router.post("/register", register); 
router.post("/login", login)
router.post("/logout", logout);
router.get("/me", requireAuth, me);

export default router;