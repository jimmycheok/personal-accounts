import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Payment extends Model {}

Payment.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER, allowNull: false },
  payment_date: { type: DataTypes.DATEONLY, allowNull: false },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false },
  method: { type: DataTypes.ENUM('cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'), defaultValue: 'bank_transfer' },
  reference: { type: DataTypes.STRING(200) },
  notes: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'payments',
  timestamps: true,
  underscored: true,
});

export default Payment;
