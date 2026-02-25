import { Router } from 'express';
import { list, create, getById, update, remove, validateTin } from '../controllers/customersController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();
router.use(verifyJwt);

router.get('/', list);
router.post('/', create);
router.post('/validate-tin', validateTin);
router.get('/:id', getById);
router.put('/:id', update);
router.delete('/:id', remove);

export default router;
