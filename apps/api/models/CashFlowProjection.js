import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class CashFlowProjection extends Model {}

CashFlowProjection.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  projection_date: { type: DataTypes.DATEONLY, allowNull: false },
  projected_income: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  projected_expenses: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  actual_income: { type: DataTypes.DECIMAL(15, 2) },
  actual_expenses: { type: DataTypes.DECIMAL(15, 2) },
  notes: { type: DataTypes.TEXT },
  generated_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
}, {
  sequelize,
  tableName: 'cash_flow_projections',
  timestamps: true,
  underscored: true,
});

export default CashFlowProjection;
