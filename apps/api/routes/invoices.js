import { Router } from 'express';
import * as ctrl from '../controllers/invoicesController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();
router.use(verifyJwt);

router.get('/next-number', ctrl.getNextNumber);
router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.put('/:id', ctrl.update);
router.delete('/:id', ctrl.remove);
router.post('/:id/send', ctrl.send);
router.post('/:id/mark-paid', ctrl.markPaid);
router.post('/:id/void', ctrl.voidInvoice);
router.post('/:id/duplicate', ctrl.duplicate);
router.get('/:id/pdf', ctrl.getPdf);
router.post('/:id/submit-einvoice', ctrl.submitEinvoice);
router.get('/:id/einvoice-status', ctrl.getEinvoiceStatus);
router.post('/:id/cancel-einvoice', ctrl.cancelEinvoice);

export default router;
