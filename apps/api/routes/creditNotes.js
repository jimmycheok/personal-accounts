import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { CreditNote, Customer, Invoice, BusinessProfile } from '../models/index.js';
import { Op } from 'sequelize';
import MyInvoisService from '../services/MyInvoisService.js';
import PdfService from '../services/PdfService.js';

const router = Router();
router.use(verifyJwt);

// CreditNote has no customer_id — customer is accessed through invoice.customer
const WITH_RELATIONS = {
  include: [
    {
      model: Invoice,
      as: 'invoice',
      attributes: ['id', 'invoice_number'],
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email'] }],
    },
  ],
};

async function getNextCreditNoteNumber(prefix = 'CN') {
  const last = await CreditNote.findOne({ order: [['id', 'DESC']] });
  const num = last ? parseInt(last.credit_note_number.replace(/[^0-9]/g, '')) + 1 : 1;
  return `${prefix}-${String(num).padStart(4, '0')}`;
}

function recalcTotals(items) {
  let subtotal = 0, taxTotal = 0;
  const recalcItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    const taxRate = parseFloat(item.tax_rate) || 0;
    const lineSubtotal = qty * price;
    const taxAmount = lineSubtotal * (taxRate / 100);
    subtotal += lineSubtotal;
    taxTotal += taxAmount;
    return { ...item, subtotal: lineSubtotal, tax_amount: taxAmount, total: lineSubtotal + taxAmount };
  });
  return { items: recalcItems, subtotal, taxTotal, total: subtotal + taxTotal };
}

// GET /credit-notes
router.get('/', async (req, res, next) => {
  try {
    const { status, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from && to) where.issue_date = { [Op.between]: [from, to] };

    const { count, rows } = await CreditNote.findAndCountAll({
      where,
      ...WITH_RELATIONS,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ creditNotes: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// POST /credit-notes
router.post('/', async (req, res, next) => {
  try {
    const { items = [], ...data } = req.body;
    const profile = await BusinessProfile.findOne();
    const prefix = profile?.credit_note_prefix || 'CN';
    const credit_note_number = data.credit_note_number || await getNextCreditNoteNumber(prefix);

    const { taxTotal, total } = recalcTotals(items);

    const creditNote = await CreditNote.create({
      ...data,
      credit_note_number,
      issue_date: data.issue_date || new Date().toISOString().split('T')[0],
      amount: data.amount ?? total,
      tax_amount: data.tax_amount ?? taxTotal,
      status: 'draft',
    });

    res.status(201).json(await CreditNote.findByPk(creditNote.id, WITH_RELATIONS));
  } catch (err) { next(err); }
});

// GET /credit-notes/:id
router.get('/:id', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id, WITH_RELATIONS);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    res.json(cn);
  } catch (err) { next(err); }
});

// PUT /credit-notes/:id
router.put('/:id', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    if (cn.status !== 'draft') return res.status(400).json({ error: 'Only draft credit notes can be edited' });

    const { items, ...data } = req.body;
    if (items) {
      const { taxTotal, total } = recalcTotals(items);
      Object.assign(data, { amount: data.amount ?? total, tax_amount: data.tax_amount ?? taxTotal });
    }

    await cn.update(data);
    res.json(await CreditNote.findByPk(cn.id, WITH_RELATIONS));
  } catch (err) { next(err); }
});

// DELETE /credit-notes/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    if (cn.status !== 'draft') return res.status(400).json({ error: 'Only draft credit notes can be deleted' });
    await cn.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

// POST /credit-notes/:id/send
router.post('/:id/send', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    await cn.update({ status: 'submitted', sent_at: new Date() });
    res.json(cn);
  } catch (err) { next(err); }
});

// POST /credit-notes/:id/void
router.post('/:id/void', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    await cn.update({ status: 'cancelled', void_reason: req.body.reason });
    res.json(cn);
  } catch (err) { next(err); }
});

// GET /credit-notes/:id/pdf
router.get('/:id/pdf', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id, WITH_RELATIONS);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    const business = await BusinessProfile.findOne();
    const pdfBuffer = await PdfService.generateCreditNotePdf(cn.toJSON(), business?.toJSON() || {});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${cn.credit_note_number}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

// POST /credit-notes/:id/submit-einvoice
router.post('/:id/submit-einvoice', async (req, res, next) => {
  try {
    const cn = await CreditNote.findByPk(req.params.id);
    if (!cn) return res.status(404).json({ error: 'Credit note not found' });
    const submission = await MyInvoisService.submitCreditNote(cn.id);
    res.json(submission);
  } catch (err) { next(err); }
});

// GET /credit-notes/:id/einvoice-status
router.get('/:id/einvoice-status', async (req, res, next) => {
  try {
    const { EinvoiceSubmission } = await import('../models/index.js');
    const submission = await EinvoiceSubmission.findOne({
      where: { credit_note_id: req.params.id },
      order: [['id', 'DESC']],
    });
    if (!submission) return res.status(404).json({ error: 'No submission found' });
    if (submission.status === 'pending' && submission.document_uid) {
      await MyInvoisService.pollStatus(submission.id);
      await submission.reload();
    }
    res.json(submission);
  } catch (err) { next(err); }
});

export default router;
