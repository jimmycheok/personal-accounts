import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Invoice extends Model {}

Invoice.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_number: { type: DataTypes.STRING(50), unique: true, allowNull: false },
  customer_id: { type: DataTypes.INTEGER, allowNull: false },
  quotation_id: { type: DataTypes.INTEGER },
  status: { type: DataTypes.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'), defaultValue: 'draft' },
  issue_date: { type: DataTypes.DATEONLY, allowNull: false },
  due_date: { type: DataTypes.DATEONLY },
  currency: { type: DataTypes.STRING(3), defaultValue: 'MYR' },
  exchange_rate: { type: DataTypes.DECIMAL(10, 6), defaultValue: 1.0 },
  subtotal: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  tax_total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  discount_total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  total: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  amount_paid: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  amount_due: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  notes: { type: DataTypes.TEXT },
  terms: { type: DataTypes.TEXT },
  sent_at: { type: DataTypes.DATE },
  paid_at: { type: DataTypes.DATE },
  void_reason: { type: DataTypes.TEXT },
  is_consolidated: { type: DataTypes.BOOLEAN, defaultValue: false },
  einvoice_long_id: { type: DataTypes.STRING(200) },
}, {
  sequelize,
  tableName: 'invoices',
  timestamps: true,
  underscored: true,
});

export default Invoice;
