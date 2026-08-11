import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { MileageLog } from '../models/index.js';
import { Op } from 'sequelize';
import JournalEntryService from '../services/JournalEntryService.js';
import LedgerQueryService from '../services/LedgerQueryService.js';

const router = Router();
router.use(verifyJwt);

// LHDN publishes no per-km mileage rate for a sole proprietor's business
// deduction — the statutory basis is actual costs (fuel, repairs, insurance,
// road tax, parking) apportioned by business use under s.33(1) ITA 1967,
// substantiated by a logbook. The RM0.60/RM0.30-tiered figure sometimes
// quoted for "LHDN mileage" is the Malaysian civil service rate (Pekeliling
// Perbendaharaan), which applies only to government staff claiming official
// travel, not to private businesses. The rate below is this owner's own
// reasonable per-km estimate, not an LHDN-prescribed figure — configurable
// via env and overridable per trip. See README.md "Mileage log" for detail.
const DEFAULT_RATE_PER_KM = parseFloat(process.env.MILEAGE_RATE_PER_KM || '0.60');

// GET /mileage
router.get('/', async (req, res, next) => {
  try {
    const { from, to, year, purpose, page = 1, limit = 50 } = req.query;
    const where = {};
    if (from && to) where.log_date = { [Op.between]: [from, to] };
    if (year) where.tax_year = parseInt(year);
    if (purpose) where.purpose = { [Op.iLike]: `%${purpose}%` };

    const { count, rows } = await MileageLog.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ logs: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// POST /mileage
router.post('/', async (req, res, next) => {
  try {
    const { log_date, from_location, to_location, km: kmRaw, purpose, rate_per_km, notes } = req.body;

    if (!log_date || !kmRaw) {
      return res.status(400).json({ error: 'log_date and km are required' });
    }

    const km = parseFloat(kmRaw);
    const rate = parseFloat(rate_per_km) || DEFAULT_RATE_PER_KM;
    const deductible_amount = km * rate;
    const tax_year = new Date(log_date).getFullYear();

    const log = await MileageLog.create({
      log_date,
      from_location,
      to_location,
      km,
      purpose,
      rate_per_km: rate,
      deductible_amount,
      tax_year,
      notes,
    });

    // The GL is the source of truth for cash flow, dashboard and tax, so a
    // mileage log must never exist without an entry. Use the client's
    // reviewed lines when present, otherwise derive them. If the GL post
    // fails, the log must not survive either — compensate by destroying it
    // so we never leave a record without a matching journal entry.
    try {
      if (req.body.journal_lines?.length) {
        await JournalEntryService.createAutoEntry({
          entryDate: log_date,
          description: `Mileage: ${from_location} → ${to_location} (${km} km)`,
          lines: req.body.journal_lines.map(l => ({ accountId: l.account_id, debit: parseFloat(l.debit || 0), credit: parseFloat(l.credit || 0), description: l.description })),
          sourceType: 'mileage',
          sourceId: log.id,
        });
      } else {
        await JournalEntryService.onMileageLogged(log);
      }
    } catch (err) {
      // The original GL error is the real cause and must survive. A failed cleanup
      // is logged loudly instead: that record now has no journal entry and will
      // need the backfill script.
      try {
        await log.destroy();
      } catch (cleanupErr) {
        console.error(
          `GL rollback failed for mileage log ${log.id} — record may have no journal entry:`,
          cleanupErr.message,
        );
      }
      throw err;
    }

    res.status(201).json(log);
  } catch (err) { next(err); }
});

// GET /mileage/summary?year=2025
router.get('/summary', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const logs = await MileageLog.findAll({ where: { tax_year: year } });

    const totalKm = logs.reduce((sum, l) => sum + parseFloat(l.km || 0), 0);
    const totalDeductible = logs.reduce((sum, l) => sum + parseFloat(l.deductible_amount || 0), 0);

    // Group by month
    const byMonth = {};
    for (const log of logs) {
      const month = log.log_date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { month, totalKm: 0, totalDeductible: 0, tripCount: 0 };
      byMonth[month].totalKm += parseFloat(log.km || 0);
      byMonth[month].totalDeductible += parseFloat(log.deductible_amount || 0);
      byMonth[month].tripCount += 1;
    }

    res.json({
      year,
      totalKm,
      totalDeductible,
      tripCount: logs.length,
      byMonth: Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month)),
    });
  } catch (err) { next(err); }
});

// GET /mileage/overlap?year=2026 — months where both actual vehicle
// receipts (6400) and mileage claims (6410) posted activity: the signal
// that a trip may have been claimed under both bases. Informational only.
router.get('/overlap', async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const months = await LedgerQueryService.getMileageOverlapByMonth(`${year}-01-01`, `${year}-12-31`);
    res.json({ year, months });
  } catch (err) { next(err); }
});

// GET /mileage/:id
router.get('/:id', async (req, res, next) => {
  try {
    const log = await MileageLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'Mileage log not found' });
    res.json(log);
  } catch (err) { next(err); }
});

// PUT /mileage/:id
router.put('/:id', async (req, res, next) => {
  try {
    const log = await MileageLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'Mileage log not found' });

    const km = parseFloat(req.body.km || log.km);
    const rate = parseFloat(req.body.rate_per_km || log.rate_per_km || DEFAULT_RATE_PER_KM);
    const deductible_amount = km * rate;
    const tax_year = req.body.log_date ? new Date(req.body.log_date).getFullYear() : log.tax_year;

    await log.update({ ...req.body, km, rate_per_km: rate, deductible_amount, tax_year });
    res.json(log);
  } catch (err) { next(err); }
});

// DELETE /mileage/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const log = await MileageLog.findByPk(req.params.id);
    if (!log) return res.status(404).json({ error: 'Mileage log not found' });
    await JournalEntryService.deleteAutoEntriesForSource('mileage', log.id);
    await log.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
