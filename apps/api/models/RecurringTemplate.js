import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class RecurringTemplate extends Model {}

RecurringTemplate.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  template_type: { type: DataTypes.ENUM('invoice', 'expense'), allowNull: false },
  frequency: { type: DataTypes.ENUM('daily', 'weekly', 'monthly', 'quarterly', 'annually'), allowNull: false },
  next_run_date: { type: DataTypes.DATEONLY, allowNull: false },
  end_date: { type: DataTypes.DATEONLY },
  template_data: { type: DataTypes.JSONB, allowNull: false },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_run_date: { type: DataTypes.DATEONLY },
  run_count: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'recurring_templates',
  timestamps: true,
  underscored: true,
});

export default RecurringTemplate;
