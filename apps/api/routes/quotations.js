import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { Quotation, QuotationItem, Customer, Invoice, InvoiceItem, BusinessProfile } from '../models/index.js';
import { Op } from 'sequelize';
import PdfService from '../services/PdfService.js';

const router = Router();
router.use(verifyJwt);

router.get('/', async (req, res, next) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const where = status ? { status } : {};
    const { count, rows } = await Quotation.findAndCountAll({
      where,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['issue_date', 'DESC']],
    });
    res.json({ quotations: rows, total: count });
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    const { items = [], ...data } = req.body;
    const profile = await BusinessProfile.findOne();
    const prefix = profile?.quotation_prefix || 'QUO';
    const last = await Quotation.findOne({ order: [['id', 'DESC']] });
    const num = last ? parseInt(last.quotation_number.replace(/[^0-9]/g, '')) + 1 : 1;
    const quotation_number = data.quotation_number || `${prefix}-${String(num).padStart(4, '0')}`;

    let subtotal = 0, tax_total = 0;
    const calcItems = items.map(item => {
      const qty = parseFloat(item.quantity) || 1;
      const price = parseFloat(item.unit_price) || 0;
      const taxRate = parseFloat(item.tax_rate) || 0;
      const lineSubtotal = qty * price;
      const taxAmount = lineSubtotal * taxRate / 100;
      subtotal += lineSubtotal;
      tax_total += taxAmount;
      return { ...item, subtotal: lineSubtotal, tax_amount: taxAmount, total: lineSubtotal + taxAmount };
    });

    const quotation = await Quotation.create({ ...data, quotation_number, subtotal, tax_total, total: subtotal + tax_total });
    if (calcItems.length) await QuotationItem.bulkCreate(calcItems.map(i => ({ ...i, quotation_id: quotation.id })));
    res.status(201).json(await Quotation.findByPk(quotation.id, { include: ['items', 'customer'] }));
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id, { include: ['customer', 'items'] });
    if (!q) return res.status(404).json({ error: 'Not found' });
    res.json(q);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    await q.update(req.body);
    res.json(q);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    await q.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:id/send', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    await q.update({ status: 'sent', sent_at: new Date() });
    res.json(q);
  } catch (err) { next(err); }
});

router.post('/:id/accept', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    await q.update({ status: 'accepted' });
    res.json(q);
  } catch (err) { next(err); }
});

router.post('/:id/reject', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id);
    if (!q) return res.status(404).json({ error: 'Not found' });
    await q.update({ status: 'rejected' });
    res.json(q);
  } catch (err) { next(err); }
});

router.post('/:id/convert-to-invoice', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id, { include: ['items'] });
    if (!q) return res.status(404).json({ error: 'Not found' });
    const profile = await BusinessProfile.findOne();
    const prefix = profile?.invoice_prefix || 'INV';
    const last = await Invoice.findOne({ order: [['id', 'DESC']] });
    const num = last ? parseInt(last.invoice_number.replace(/[^0-9]/g, '')) + 1 : 1;
    const invoice_number = `${prefix}-${String(num).padStart(4, '0')}`;

    const invoice = await Invoice.create({
      invoice_number,
      customer_id: q.customer_id,
      quotation_id: q.id,
      issue_date: new Date().toISOString().split('T')[0],
      due_date: req.body.due_date,
      status: 'draft',
      currency: q.currency,
      subtotal: q.subtotal,
      tax_total: q.tax_total,
      total: q.total,
      amount_due: q.total,
      notes: q.notes,
    });

    await InvoiceItem.bulkCreate(q.items.map(item => ({
      ...item.toJSON(), id: undefined, invoice_id: invoice.id, quotation_id: undefined,
    })));

    await q.update({ converted_invoice_id: invoice.id, status: 'accepted' });
    res.status(201).json(invoice);
  } catch (err) { next(err); }
});

router.get('/:id/pdf', async (req, res, next) => {
  try {
    const q = await Quotation.findByPk(req.params.id, { include: ['customer', 'items'] });
    if (!q) return res.status(404).json({ error: 'Not found' });
    const business = await BusinessProfile.findOne();
    const pdfBuffer = await PdfService.generateQuotationPdf(q.toJSON(), business?.toJSON() || {});
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${q.quotation_number}.pdf"` });
    res.send(pdfBuffer);
  } catch (err) { next(err); }
});

export default router;
