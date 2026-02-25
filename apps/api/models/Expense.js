import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Expense extends Model {}

Expense.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  vendor_name: { type: DataTypes.STRING(200), allowNull: false },
  description: { type: DataTypes.TEXT },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  currency: { type: DataTypes.STRING(3), defaultValue: 'MYR' },
  exchange_rate: { type: DataTypes.DECIMAL(10, 6), defaultValue: 1.0 },
  amount_myr: { type: DataTypes.DECIMAL(15, 2) },
  expense_date: { type: DataTypes.DATEONLY, allowNull: false },
  category_id: { type: DataTypes.INTEGER },
  is_tax_deductible: { type: DataTypes.BOOLEAN, defaultValue: true },
  tax_year: { type: DataTypes.INTEGER },
  ocr_confidence: { type: DataTypes.DECIMAL(5, 2) },
  ocr_raw: { type: DataTypes.JSONB },
  receipt_path: { type: DataTypes.STRING(500) },
  notes: { type: DataTypes.TEXT },
  is_recurring: { type: DataTypes.BOOLEAN, defaultValue: false },
  recurring_template_id: { type: DataTypes.INTEGER },
}, {
  sequelize,
  tableName: 'expenses',
  timestamps: true,
  underscored: true,
});

export default Expense;
