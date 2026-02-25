import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class InvoiceItem extends Model {}

InvoiceItem.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: false },
  quantity: { type: DataTypes.DECIMAL(10, 3), defaultValue: 1 },
  unit_price: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  tax_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  discount_rate: { type: DataTypes.DECIMAL(5, 2), defaultValue: 0 },
  subtotal: { type: DataTypes.DECIMAL(15, 2) },
  tax_amount: { type: DataTypes.DECIMAL(15, 2) },
  total: { type: DataTypes.DECIMAL(15, 2) },
  classification_code: { type: DataTypes.STRING(20) },
  sort_order: { type: DataTypes.INTEGER, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'invoice_items',
  timestamps: true,
  underscored: true,
});

export default InvoiceItem;
