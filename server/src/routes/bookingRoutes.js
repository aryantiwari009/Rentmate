import { Router } from "express";

import { requireAuth } from "../middleware/requireAuth.js";
import { cancelBooking, createBooking, getBooking } from "../controllers/bookingController.js";

const router = Router();

router.post("/", requireAuth, createBooking);
router.get("/", requireAuth, getBooking);
router.patch("/:id/cancel", requireAuth, cancelBooking);

export default router;