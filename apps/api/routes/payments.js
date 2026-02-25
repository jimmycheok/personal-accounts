import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { Payment, Invoice } from '../models/index.js';

// Mounted at /invoices/:invoiceId/payments
const router = Router({ mergeParams: true });
router.use(verifyJwt);

// GET /invoices/:invoiceId/payments
router.get('/', async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const payments = await Payment.findAll({
      where: { invoice_id: req.params.invoiceId },
      order: [['payment_date', 'DESC']],
    });
    res.json(payments);
  } catch (err) { next(err); }
});

// POST /invoices/:invoiceId/payments
router.post('/', async (req, res, next) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status === 'void') return res.status(400).json({ error: 'Cannot add payment to void invoice' });

    const { amount, payment_date, payment_method, reference, notes } = req.body;
    if (!amount || parseFloat(amount) <= 0) return res.status(400).json({ error: 'Valid amount required' });

    const payment = await Payment.create({
      invoice_id: invoice.id,
      amount: parseFloat(amount),
      payment_date: payment_date || new Date().toISOString().split('T')[0],
      payment_method: payment_method || 'bank_transfer',
      reference,
      notes,
    });

    // Recalculate invoice amounts paid / due
    const allPayments = await Payment.findAll({ where: { invoice_id: invoice.id } });
    const totalPaid = allPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const amountDue = Math.max(0, parseFloat(invoice.total) - totalPaid);
    const newStatus = amountDue <= 0 ? 'paid' : invoice.status;
    await invoice.update({
      amount_paid: totalPaid,
      amount_due: amountDue,
      status: newStatus,
      paid_at: newStatus === 'paid' ? new Date() : invoice.paid_at,
    });

    res.status(201).json({ payment, invoice: await invoice.reload() });
  } catch (err) { next(err); }
});

// GET /invoices/:invoiceId/payments/:id
router.get('/:id', async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: { id: req.params.id, invoice_id: req.params.invoiceId },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });
    res.json(payment);
  } catch (err) { next(err); }
});

// DELETE /invoices/:invoiceId/payments/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const payment = await Payment.findOne({
      where: { id: req.params.id, invoice_id: req.params.invoiceId },
    });
    if (!payment) return res.status(404).json({ error: 'Payment not found' });

    await payment.destroy();

    // Recalculate invoice after deletion
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    const remaining = await Payment.findAll({ where: { invoice_id: req.params.invoiceId } });
    const totalPaid = remaining.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const amountDue = Math.max(0, parseFloat(invoice.total) - totalPaid);
    await invoice.update({
      amount_paid: totalPaid,
      amount_due: amountDue,
      status: amountDue <= 0 ? 'paid' : 'sent',
      paid_at: amountDue <= 0 ? invoice.paid_at : null,
    });

    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
