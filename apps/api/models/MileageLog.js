import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class MileageLog extends Model {}

MileageLog.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  log_date: { type: DataTypes.DATEONLY, allowNull: false },
  from_location: { type: DataTypes.STRING(300) },
  to_location: { type: DataTypes.STRING(300) },
  purpose: { type: DataTypes.TEXT, allowNull: false },
  km: { type: DataTypes.DECIMAL(8, 2), allowNull: false },
  rate_per_km: { type: DataTypes.DECIMAL(6, 4), defaultValue: 0.25 },
  deductible_amount: { type: DataTypes.DECIMAL(10, 2) },
  tax_year: { type: DataTypes.INTEGER },
  notes: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'mileage_logs',
  timestamps: true,
  underscored: true,
});

export default MileageLog;
