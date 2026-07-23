import { Router } from 'express';
import {
  list, create, getById, update, approve, voidVoucher, remove, pdf,
} from '../controllers/paymentVouchersController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();
router.use(verifyJwt);

router.get('/', list);
router.post('/', create);
router.get('/:id', getById);
router.get('/:id/pdf', pdf);
router.put('/:id', update);
router.post('/:id/approve', approve);
router.post('/:id/void', voidVoucher);
router.delete('/:id', remove);

export default router;
