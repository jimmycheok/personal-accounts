import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class JournalEntryLine extends Model {}

JournalEntryLine.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  journal_entry_id: { type: DataTypes.INTEGER, allowNull: false },
  account_id: { type: DataTypes.INTEGER, allowNull: false },
  debit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  credit: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
  description: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'journal_entry_lines',
  timestamps: true,
  underscored: true,
});

export default JournalEntryLine;
