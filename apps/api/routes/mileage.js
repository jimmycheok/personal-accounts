import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { MileageLog } from '../models/index.js';
import { Op } from 'sequelize';

const router = Router();
router.use(verifyJwt);

// Malaysian LHDN approved mileage rate (MYR per km) — as of 2024
// First 200km per month: RM0.60/km; thereafter RM0.40/km
// For simplicity we expose a configurable rate via env or default
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
    await log.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
