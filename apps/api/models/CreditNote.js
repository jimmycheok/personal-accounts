import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class CreditNote extends Model {}

CreditNote.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  credit_note_number: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  issue_date: { type: DataTypes.DATEONLY, allowNull: false },
  reason: { type: DataTypes.TEXT },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  tax_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('draft', 'submitted', 'valid', 'cancelled'), defaultValue: 'draft' },
  einvoice_long_id: { type: DataTypes.STRING(200) },
  notes: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'credit_notes',
  timestamps: true,
  underscored: true,
});

export default CreditNote;
