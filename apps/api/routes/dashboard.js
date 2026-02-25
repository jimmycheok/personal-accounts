import { Router } from 'express';
import { overview, outstandingInvoices, recentTransactions, taxEstimate, upcomingDeadlines, cashFlowSnapshot } from '../controllers/dashboardController.js';
import { verifyJwt } from '../middlewares/verifyJwt.js';

const router = Router();
router.use(verifyJwt);

router.get('/overview', overview);
router.get('/outstanding-invoices', outstandingInvoices);
router.get('/recent-transactions', recentTransactions);
router.get('/tax-estimate', taxEstimate);
router.get('/upcoming-deadlines', upcomingDeadlines);
router.get('/cash-flow-snapshot', cashFlowSnapshot);

export default router;
