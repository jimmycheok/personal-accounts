import { Router } from 'express';
import { list, create, getById, update, remove, ocrReceipt, uploadMiddleware } from '../controllers/expensesController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();
router.use(verifyJwt);

router.post('/ocr', uploadMiddleware, ocrReceipt);
router.get('/', list);
router.post('/', create);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
