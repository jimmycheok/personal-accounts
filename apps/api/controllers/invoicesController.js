import { Invoice, InvoiceItem, Customer, Payment, BusinessProfile } from '../models/index.js';
import { Op } from 'sequelize';
import { writeAuditLog } from '../middlewares/auditLog.js';
import PdfService from '../services/PdfService.js';
import DuitNowService from '../services/DuitNowService.js';
import MyInvoisService from '../services/MyInvoisService.js';

function recalcTotals(items) {
  let subtotal = 0, taxTotal = 0;
  const recalcItems = items.map(item => {
    const qty = parseFloat(item.quantity) || 1;
    const price = parseFloat(item.unit_price) || 0;
    const taxRate = parseFloat(item.tax_rate) || 0;
    const discRate = parseFloat(item.discount_rate) || 0;
    const lineSubtotal = qty * price * (1 - discRate / 100);
    const taxAmount = lineSubtotal * (taxRate / 100);
    subtotal += lineSubtotal;
    taxTotal += taxAmount;
    return { ...item, subtotal: lineSubtotal, tax_amount: taxAmount, total: lineSubtotal + taxAmount };
  });
  return { items: recalcItems, subtotal, taxTotal, total: subtotal + taxTotal };
}

async function getNextInvoiceNumber(prefix = 'INV') {
  const last = await Invoice.findOne({ order: [['id', 'DESC']] });
  const num = last ? parseInt(last.invoice_number.replace(/[^0-9]/g, '')) + 1 : 1;
  return `${prefix}-${String(num).padStart(4, '0')}`;
}

export async function list(req, res, next) {
  try {
    const { status, customerId, from, to, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (customerId) where.customer_id = customerId;
    if (from && to) where.issue_date = { [Op.between]: [from, to] };

    const { count, rows } = await Invoice.findAndCountAll({
      where,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name', 'email'] }],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ invoices: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const { items = [], ...invoiceData } = req.body;
    const profile = await BusinessProfile.findOne();
    const prefix = profile?.invoice_prefix || 'INV';
    const invoiceNumber = invoiceData.invoice_number || await getNextInvoiceNumber(prefix);

    const { items: calcItems, subtotal, taxTotal, total } = recalcTotals(items);

    const invoice = await Invoice.create({
      ...invoiceData,
      invoice_number: invoiceNumber,
      subtotal,
      tax_total: taxTotal,
      total,
      amount_due: total,
    });

    if (calcItems.length) {
      await InvoiceItem.bulkCreate(calcItems.map(item => ({ ...item, invoice_id: invoice.id })));
    }

    await writeAuditLog({ action: 'create', subjectType: 'Invoice', subjectId: invoice.id });
    res.status(201).json(await Invoice.findByPk(invoice.id, { include: ['items', 'customer'] }));
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [
        { model: Customer, as: 'customer' },
        { model: InvoiceItem, as: 'items' },
        { model: Payment, as: 'payments' },
      ],
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id, { include: ['items'] });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (['paid', 'void'].includes(invoice.status)) {
      return res.status(400).json({ error: 'Cannot edit paid or void invoice' });
    }

    const { items, ...invoiceData } = req.body;
    const before = invoice.toJSON();

    if (items) {
      await InvoiceItem.destroy({ where: { invoice_id: invoice.id } });
      const { items: calcItems, subtotal, taxTotal, total } = recalcTotals(items);
      await InvoiceItem.bulkCreate(calcItems.map(item => ({ ...item, invoice_id: invoice.id })));
      Object.assign(invoiceData, { subtotal, tax_total: taxTotal, total, amount_due: total - (invoice.amount_paid || 0) });
    }

    await invoice.update(invoiceData);
    await writeAuditLog({ action: 'update', subjectType: 'Invoice', subjectId: invoice.id, before, after: invoice.toJSON() });
    res.json(await Invoice.findByPk(invoice.id, { include: ['items', 'customer'] }));
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    if (invoice.status !== 'draft') return res.status(400).json({ error: 'Only draft invoices can be deleted' });
    await invoice.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function send(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    await invoice.update({ status: 'sent', sent_at: new Date() });
    await writeAuditLog({ action: 'send', subjectType: 'Invoice', subjectId: invoice.id });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function markPaid(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    await invoice.update({ status: 'paid', paid_at: new Date(), amount_paid: invoice.total, amount_due: 0 });
    await writeAuditLog({ action: 'mark_paid', subjectType: 'Invoice', subjectId: invoice.id });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function voidInvoice(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id);
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
    await invoice.update({ status: 'void', void_reason: req.body.reason });
    await writeAuditLog({ action: 'void', subjectType: 'Invoice', subjectId: invoice.id });
    res.json(invoice);
  } catch (err) {
    next(err);
  }
}

export async function duplicate(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id, { include: ['items'] });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const profile = await BusinessProfile.findOne();
    const prefix = profile?.invoice_prefix || 'INV';
    const newNumber = await getNextInvoiceNumber(prefix);

    const newInvoice = await Invoice.create({
      ...invoice.toJSON(),
      id: undefined,
      invoice_number: newNumber,
      status: 'draft',
      sent_at: null,
      paid_at: null,
      amount_paid: 0,
      amount_due: invoice.total,
      issue_date: new Date().toISOString().split('T')[0],
      einvoice_long_id: null,
      createdAt: undefined,
      updatedAt: undefined,
    });

    await InvoiceItem.bulkCreate(
      invoice.items.map(item => ({ ...item.toJSON(), id: undefined, invoice_id: newInvoice.id }))
    );

    res.status(201).json(newInvoice);
  } catch (err) {
    next(err);
  }
}

export async function getPdf(req, res, next) {
  try {
    const invoice = await Invoice.findByPk(req.params.id, {
      include: [{ model: Customer, as: 'customer' }, { model: InvoiceItem, as: 'items' }],
    });
    if (!invoice) return res.status(404).json({ error: 'Invoice not found' });

    const business = await BusinessProfile.findOne();

    // Generate DuitNow QR
    const qrDataUrl = business?.bank_account_number ? await DuitNowService.generateQR({
      amount: invoice.amount_due,
      reference: invoice.invoice_number,
      businessName: business.business_name,
      accountNumber: business.bank_account_number,
    }) : null;

    const pdfBuffer = await PdfService.generateInvoicePdf(
      { ...invoice.toJSON(), qrDataUrl },
      business?.toJSON() || {}
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoice_number}.pdf"`,
    });
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
}

export async function submitEinvoice(req, res, next) {
  try {
    const submission = await MyInvoisService.submitDocument(req.params.id);
    res.json(submission);
  } catch (err) {
    next(err);
  }
}

export async function getEinvoiceStatus(req, res, next) {
  try {
    const { EinvoiceSubmission } = await import('../models/index.js');
    const submission = await EinvoiceSubmission.findOne({
      where: { invoice_id: req.params.id },
      order: [['id', 'DESC']],
    });
    if (!submission) return res.status(404).json({ error: 'No submission found' });

    if (submission.status === 'pending' && submission.document_uid) {
      await MyInvoisService.pollStatus(submission.id);
      await submission.reload();
    }

    res.json(submission);
  } catch (err) {
    next(err);
  }
}

export async function cancelEinvoice(req, res, next) {
  try {
    const { EinvoiceSubmission } = await import('../models/index.js');
    const submission = await EinvoiceSubmission.findOne({
      where: { invoice_id: req.params.id },
      order: [['id', 'DESC']],
    });
    if (!submission) return res.status(404).json({ error: 'No submission found' });
    const result = await MyInvoisService.cancelDocument(submission.id, req.body.reason);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getNextNumber(req, res, next) {
  try {
    const profile = await BusinessProfile.findOne();
    const prefix = profile?.invoice_prefix || 'INV';
    const last = await Invoice.findOne({ order: [['id', 'DESC']] });
    const num = last ? parseInt(last.invoice_number.replace(/[^0-9]/g, '')) + 1 : 1;
    res.json({ nextNumber: `${prefix}-${String(num).padStart(4, '0')}` });
  } catch (err) {
    next(err);
  }
}
