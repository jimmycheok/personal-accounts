import { Router } from 'express';
import { login, changePassword, getMe } from '../controllers/authController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();

router.post('/login', login);
router.post('/change-password', verifyJwt, changePassword);
router.get('/me', verifyJwt, getMe);

export default router;
