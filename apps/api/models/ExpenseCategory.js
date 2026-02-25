import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class ExpenseCategory extends Model {}

ExpenseCategory.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  borang_b_section: { type: DataTypes.STRING(5) },
  is_capital_allowance: { type: DataTypes.BOOLEAN, defaultValue: false },
  is_tax_deductible: { type: DataTypes.BOOLEAN, defaultValue: true },
  parent_id: { type: DataTypes.INTEGER },
  is_system: { type: DataTypes.BOOLEAN, defaultValue: false },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'expense_categories',
  timestamps: true,
  underscored: true,
});

export default ExpenseCategory;
