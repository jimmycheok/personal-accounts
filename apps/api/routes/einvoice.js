import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { EinvoiceSubmission, Invoice, EinvoiceConfig } from '../models/index.js';
import { Op } from 'sequelize';
import MyInvoisService from '../services/MyInvoisService.js';

const router = Router();
router.use(verifyJwt);

// GET /einvoice/submissions — list all e-invoice submissions
router.get('/submissions', async (req, res, next) => {
  try {
    const { status, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from && to) where.createdAt = { [Op.between]: [new Date(from), new Date(to)] };

    const { count, rows } = await EinvoiceSubmission.findAndCountAll({
      where,
      include: [{ model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number', 'total'] }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ submissions: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /einvoice/submissions/:id — get single submission
router.get('/submissions/:id', async (req, res, next) => {
  try {
    const submission = await EinvoiceSubmission.findByPk(req.params.id, {
      include: [{ model: Invoice, as: 'invoice', attributes: ['id', 'invoice_number', 'total', 'status'] }],
    });
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    res.json(submission);
  } catch (err) { next(err); }
});

// POST /einvoice/submissions/:id/retry — retry a failed submission
router.post('/submissions/:id/retry', async (req, res, next) => {
  try {
    const submission = await EinvoiceSubmission.findByPk(req.params.id);
    if (!submission) return res.status(404).json({ error: 'Submission not found' });
    if (!['failed', 'rejected'].includes(submission.status)) {
      return res.status(400).json({ error: 'Only failed or rejected submissions can be retried' });
    }

    const result = await MyInvoisService.submitDocument(submission.invoice_id);
    res.json(result);
  } catch (err) { next(err); }
});

// POST /einvoice/consolidated/submit — submit consolidated e-invoice for a date range
router.post('/consolidated/submit', async (req, res, next) => {
  try {
    const { from, to, invoiceIds } = req.body;
    if (!from || !to) return res.status(400).json({ error: 'from and to dates are required' });

    const result = await MyInvoisService.submitConsolidated({ from, to, invoiceIds });
    res.json(result);
  } catch (err) { next(err); }
});

// GET /einvoice/validate-tin/:tin — validate a TIN number against MyInvois
router.get('/validate-tin/:tin', async (req, res, next) => {
  try {
    const { idType = 'NRIC', idValue } = req.query;
    if (!idValue) return res.status(400).json({ error: 'idValue query param is required' });
    const result = await MyInvoisService.validateTin(req.params.tin, idType, idValue);
    res.json(result);
  } catch (err) { next(err); }
});

// GET /einvoice/config-status — check if e-invoice is configured and enabled
router.get('/config-status', async (req, res, next) => {
  try {
    const config = await EinvoiceConfig.findOne({ order: [['id', 'DESC']] });
    res.json({
      configured: !!config,
      enabled: config?.is_enabled || false,
      sandbox: config?.is_sandbox ?? true,
      tin: config?.tin || null,
      lastTestedAt: config?.last_tested_at || null,
      lastTestSuccess: config?.last_test_success ?? null,
    });
  } catch (err) { next(err); }
});

export default router;
