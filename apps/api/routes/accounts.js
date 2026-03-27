import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { list, create, update, getLedger } from '../controllers/accountsController.js';

const router = Router();
router.use(verifyJwt);

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.get('/:id/ledger', getLedger);

export default router;
