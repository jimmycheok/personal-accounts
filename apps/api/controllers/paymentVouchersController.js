import { Op } from 'sequelize';
import {
  sequelize,
  PaymentVoucher,
  PaymentVoucherLine,
  Account,
  JournalEntry,
  JournalEntryLine,
  Document,
  BusinessProfile,
} from '../models/index.js';
import { writeAuditLog } from '../middlewares/auditLog.js';
import JournalEntryService from '../services/JournalEntryService.js';
import PdfService from '../services/PdfService.js';
import StorageService from '../services/StorageService.js';

// PV-YYYYMM-NNNN, assigned when the voucher is saved (GL posted)
async function getNextPvNumber(date) {
  const d = new Date(date);
  const yyyymm = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
  const pattern = `PV-${yyyymm}-%`;
  const last = await PaymentVoucher.findOne({
    where: { pv_number: { [Op.like]: pattern } },
    order: [['pv_number', 'DESC']],
  });
  let seq = 1;
  if (last) {
    const parts = last.pv_number.split('-');
    seq = parseInt(parts[parts.length - 1], 10) + 1;
  }
  return `PV-${yyyymm}-${String(seq).padStart(4, '0')}`;
}

function computeTotal(lines) {
  return (lines || []).reduce((sum, l) => sum + (parseFloat(l.amount) || 0), 0);
}

const LINE_INCLUDE = { model: PaymentVoucherLine, as: 'lines' };

export async function list(req, res, next) {
  try {
    const { status, from, to, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (from && to) where.pv_date = { [Op.between]: [from, to] };
    if (search) {
      where[Op.or] = [
        { payee_name: { [Op.iLike]: `%${search}%` } },
        { pv_number: { [Op.iLike]: `%${search}%` } },
      ];
    }
    const { count, rows } = await PaymentVoucher.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });
    res.json({ vouchers: rows, total: count, page: parseInt(page) });
  } catch (err) { next(err); }
}

// Create a voucher. When balanced journal_lines are supplied (the normal flow via
// the GL modal), the entry posts to the GL immediately and the voucher is marked
// approved with a PV number — mirroring the Expense create flow.
export async function create(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const { lines = [], journal_lines, status, pv_number, approved_at, total_amount, ...data } = req.body;
    const total = computeTotal(lines);
    const posting = Array.isArray(journal_lines) && journal_lines.length >= 2;
    const pvNumber = posting ? await getNextPvNumber(data.pv_date) : null;

    const voucher = await PaymentVoucher.create({
      ...data,
      pv_number: pvNumber,
      total_amount: total,
      status: posting ? 'approved' : 'draft',
      approved_at: posting ? new Date() : null,
    }, { transaction: t });

    if (lines.length) {
      await PaymentVoucherLine.bulkCreate(
        lines.map(l => ({
          payment_voucher_id: voucher.id,
          service_item: l.service_item || null,
          amount: parseFloat(l.amount) || 0,
        })),
        { transaction: t },
      );
    }
    await t.commit();

    if (posting) {
      // createAutoEntry re-validates DR = CR and throws if unbalanced
      await JournalEntryService.createAutoEntry({
        entryDate: voucher.pv_date,
        description: `Payment Voucher ${pvNumber} — ${voucher.payee_name}`,
        lines: journal_lines.map(l => ({
          accountId: l.account_id,
          debit: parseFloat(l.debit || 0),
          credit: parseFloat(l.credit || 0),
          description: l.description || null,
        })),
        sourceType: 'payment_voucher',
        sourceId: voucher.id,
      });
    }

    await writeAuditLog({ action: 'create', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.status(201).json(full);
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { include: [LINE_INCLUDE] });
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    const journalEntry = await JournalEntry.findOne({
      where: { source_type: 'payment_voucher', source_id: voucher.id },
      include: [{ model: JournalEntryLine, as: 'lines', include: [{ model: Account, as: 'account' }] }],
    });
    res.json({ ...voucher.toJSON(), journalEntry });
  } catch (err) { next(err); }
}

// Edit a not-yet-posted draft (kept for completeness; the normal flow posts on create).
export async function update(req, res, next) {
  const t = await sequelize.transaction();
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { transaction: t });
    if (!voucher) { await t.rollback(); return res.status(404).json({ error: 'Payment voucher not found' }); }
    if (voucher.status !== 'draft') {
      await t.rollback();
      return res.status(409).json({ error: 'Only draft vouchers can be edited' });
    }
    const { lines, status, pv_number, approved_at, total_amount, journal_lines, ...data } = req.body;
    if (Array.isArray(lines)) {
      await PaymentVoucherLine.destroy({ where: { payment_voucher_id: voucher.id }, transaction: t });
      await PaymentVoucherLine.bulkCreate(
        lines.map(l => ({
          payment_voucher_id: voucher.id,
          service_item: l.service_item || null,
          amount: parseFloat(l.amount) || 0,
        })),
        { transaction: t },
      );
      data.total_amount = computeTotal(lines);
    }
    await voucher.update(data, { transaction: t });
    await t.commit();
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.json(full);
  } catch (err) {
    await t.rollback();
    next(err);
  }
}

export async function voidVoucher(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    if (voucher.status !== 'approved') return res.status(409).json({ error: 'Only posted vouchers can be voided' });
    await JournalEntryService.deleteAutoEntriesForSource('payment_voucher', voucher.id);
    await voucher.update({ status: 'voided' });
    await writeAuditLog({ action: 'void', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    const full = await PaymentVoucher.findByPk(voucher.id, { include: [LINE_INCLUDE] });
    res.json(full);
  } catch (err) { next(err); }
}

export async function remove(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id);
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    if (voucher.status !== 'draft') return res.status(409).json({ error: 'Only draft vouchers can be deleted; void a posted voucher instead' });

    // Clean up any staged attachments
    const docs = await Document.findAll({ where: { subject_type: 'payment_voucher', subject_id: voucher.id } });
    for (const doc of docs) {
      try { await StorageService.delete(doc.storage_path, doc.storage_type); } catch (e) { console.warn('Storage delete failed:', e.message); }
      await doc.destroy();
    }

    await PaymentVoucherLine.destroy({ where: { payment_voucher_id: voucher.id } });
    await voucher.destroy();
    await writeAuditLog({ action: 'delete', subjectType: 'PaymentVoucher', subjectId: voucher.id });
    res.status(204).send();
  } catch (err) { next(err); }
}

export async function pdf(req, res, next) {
  try {
    const voucher = await PaymentVoucher.findByPk(req.params.id, { include: [LINE_INCLUDE] });
    if (!voucher) return res.status(404).json({ error: 'Payment voucher not found' });
    const business = await BusinessProfile.findOne();
    const buffer = await PdfService.generatePaymentVoucherPdf(voucher.toJSON(), business ? business.toJSON() : {});
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${voucher.pv_number || 'payment-voucher-draft'}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.send(buffer);
  } catch (err) { next(err); }
}
