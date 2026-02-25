import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class BankStatement extends Model {}

BankStatement.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  bank_name: { type: DataTypes.STRING(100) },
  account_number: { type: DataTypes.STRING(50) },
  statement_period_start: { type: DataTypes.DATEONLY },
  statement_period_end: { type: DataTypes.DATEONLY },
  opening_balance: { type: DataTypes.DECIMAL(15, 2) },
  closing_balance: { type: DataTypes.DECIMAL(15, 2) },
  file_name: { type: DataTypes.STRING(300) },
  import_status: { type: DataTypes.ENUM('imported', 'partial', 'reconciled'), defaultValue: 'imported' },
  total_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
  matched_rows: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'bank_statements',
  timestamps: true,
  underscored: true,
});

export default BankStatement;
