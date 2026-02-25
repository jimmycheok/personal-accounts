import { Customer } from '../models/index.js';
import { Op } from 'sequelize';
import MyInvoisService from '../services/MyInvoisService.js';

export async function list(req, res, next) {
  try {
    const { search, type, page = 1, limit = 50 } = req.query;
    const where = {};
    if (search) where.name = { [Op.iLike]: `%${search}%` };
    if (type) where.customer_type = type;

    const { count, rows } = await Customer.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['name', 'ASC']],
    });

    res.json({ customers: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

export async function create(req, res, next) {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (err) {
    next(err);
  }
}

export async function getById(req, res, next) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

export async function update(req, res, next) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    await customer.update(req.body);
    res.json(customer);
  } catch (err) {
    next(err);
  }
}

export async function remove(req, res, next) {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    await customer.destroy();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function validateTin(req, res, next) {
  try {
    const { tin, idType, idValue } = req.body;
    const result = await MyInvoisService.validateTin(tin, idType, idValue);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
