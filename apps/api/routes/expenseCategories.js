import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { ExpenseCategory } from '../models/index.js';

const router = Router();
router.use(verifyJwt);

// LHDN Borang B expense category codes for Malaysian sole proprietors
const BORANG_B_MAPPING = {
  'Cost of Sales': 'A1',
  'Salaries & Wages': 'B1',
  'EPF Contributions': 'B2',
  'SOCSO Contributions': 'B3',
  'Rental': 'C1',
  'Utilities': 'C2',
  'Telephone & Internet': 'C3',
  'Travelling & Transport': 'D1',
  'Motor Vehicle Expenses': 'D2',
  'Entertainment': 'E1',
  'Repairs & Maintenance': 'F1',
  'Insurance': 'F2',
  'Professional Fees': 'G1',
  'Advertising & Marketing': 'H1',
  'Office Supplies & Stationery': 'I1',
  'Depreciation': 'J1',
  'Bad Debts': 'K1',
  'Miscellaneous': 'Z1',
};

// GET /expense-categories
router.get('/', async (req, res, next) => {
  try {
    const categories = await ExpenseCategory.findAll({ order: [['name', 'ASC']] });
    res.json(categories);
  } catch (err) { next(err); }
});

// POST /expense-categories
router.post('/', async (req, res, next) => {
  try {
    const { name, description, borang_b_code, color, is_deductible } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    const category = await ExpenseCategory.create({ name, description, borang_b_code, color, is_deductible });
    res.status(201).json(category);
  } catch (err) { next(err); }
});

// GET /expense-categories/borang-b-mapping
router.get('/borang-b-mapping', (req, res) => {
  res.json(BORANG_B_MAPPING);
});

// GET /expense-categories/:id
router.get('/:id', async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) { next(err); }
});

// PUT /expense-categories/:id
router.put('/:id', async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    await category.update(req.body);
    res.json(category);
  } catch (err) { next(err); }
});

// DELETE /expense-categories/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const category = await ExpenseCategory.findByPk(req.params.id);
    if (!category) return res.status(404).json({ error: 'Category not found' });
    await category.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
