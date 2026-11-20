import { Router } from 'express';
import { listCosts } from '../controllers/costs.controller.js';
const router = Router();
router.get('/', listCosts);
export default router;
