import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class BankStatementRow extends Model {}

BankStatementRow.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  bank_statement_id: { type: DataTypes.INTEGER, allowNull: false },
  transaction_date: { type: DataTypes.DATEONLY },
  description: { type: DataTypes.TEXT },
  reference: { type: DataTypes.STRING(200) },
  debit: { type: DataTypes.DECIMAL(15, 2) },
  credit: { type: DataTypes.DECIMAL(15, 2) },
  balance: { type: DataTypes.DECIMAL(15, 2) },
  matched_type: { type: DataTypes.STRING(50) },
  matched_id: { type: DataTypes.INTEGER },
  is_reconciled: { type: DataTypes.BOOLEAN, defaultValue: false },
  notes: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'bank_statement_rows',
  timestamps: true,
  underscored: true,
});

export default BankStatementRow;
