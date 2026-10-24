import { Router } from 'express'
import { getProducts, getProductsById } from '../controllers/productController.js'

const router = Router();
// "/" here means the base path chosen in server.js
router.get("/", getProducts); 
router.get('/:id', getProductsById);

export default router;