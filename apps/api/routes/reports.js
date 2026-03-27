import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import ReportService from '../services/ReportService.js';
import JournalEntryService from '../services/JournalEntryService.js';
import PdfService from '../services/PdfService.js';
import { BusinessProfile } from '../models/index.js';

const router = Router();
router.use(verifyJwt);

// GET /reports/profit-loss?from=&to=
router.get('/profit-loss', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });
    const report = await ReportService.getProfitLoss(from, to);
    res.json(report);
  } catch (err) { next(err); }
});

// GET /reports/profit-loss/pdf?from=&to=
router.get('/profit-loss/pdf', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });
    const report = await ReportService.getProfitLoss(from, to);
    const business = await BusinessProfile.findOne();
    const pdfBuffer = await PdfService.generateProfitLossPdf(report, business?.toJSON() || {});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="PL-${from}-to-${to}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// GET /reports/balance-sheet?as_at=
router.get('/balance-sheet', async (req, res, next) => {
  try {
    const { as_at } = req.query;
    if (!as_at) return res.status(400).json({ error: 'as_at date is required' });
    const report = await ReportService.getBalanceSheet(as_at);
    res.json(report);
  } catch (err) { next(err); }
});

// GET /reports/balance-sheet/pdf?as_at=
router.get('/balance-sheet/pdf', async (req, res, next) => {
  try {
    const { as_at } = req.query;
    if (!as_at) return res.status(400).json({ error: 'as_at date is required' });
    const report = await ReportService.getBalanceSheet(as_at);
    const business = await BusinessProfile.findOne();
    const pdfBuffer = await PdfService.generateBalanceSheetPdf(report, business?.toJSON() || {});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="BS-${as_at}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// GET /reports/trial-balance?as_at=
router.get('/trial-balance', async (req, res, next) => {
  try {
    const { as_at } = req.query;
    if (!as_at) return res.status(400).json({ error: 'as_at date is required' });
    const report = await ReportService.getTrialBalance(as_at);
    res.json(report);
  } catch (err) { next(err); }
});

// POST /reports/year-end-close?year=
router.post('/year-end-close', async (req, res, next) => {
  try {
    const { year } = req.query;
    if (!year) return res.status(400).json({ error: 'year is required' });
    const result = await JournalEntryService.yearEndClose(parseInt(year));
    res.json(result);
  } catch (err) { next(err); }
});

export default router;
