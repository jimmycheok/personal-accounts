import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Quotation extends Model {}

Quotation.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  quotation_number: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  customer_id: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.ENUM('draft', 'sent', 'accepted', 'rejected', 'expired'), defaultValue: 'draft' },
  issue_date: { type: DataTypes.DATEONLY, allowNull: false },
  expiry_date: { type: DataTypes.DATEONLY },
  converted_invoice_id: { type: DataTypes.INTEGER },
  currency: { type: DataTypes.STRING(3), defaultValue: 'MYR' },
  exchange_rate: { type: DataTypes.DECIMAL(10, 6), defaultValue: 1.0 },
  subtotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  tax_total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  discount_total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
  terms: { type: DataTypes.TEXT },
  sent_at: { type: DataTypes.DATE },
}, {
  sequelize,
  tableName: 'quotations',
  timestamps: true,
  underscored: true,
});

export default Quotation;
