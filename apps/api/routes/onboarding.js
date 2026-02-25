import { Router } from 'express';
import { getStatus, complete } from '../controllers/onboardingController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();

router.get('/status', verifyJwt, getStatus);
router.post('/complete', verifyJwt, complete);

export default router;
