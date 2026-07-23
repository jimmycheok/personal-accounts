import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class PaymentVoucher extends Model {}

PaymentVoucher.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  pv_number: { type: DataTypes.STRING(30), allowNull: true, unique: true },
  pv_date: { type: DataTypes.DATEONLY, allowNull: false },
  payee_name: { type: DataTypes.STRING(200), allowNull: false },
  payee_bank_name: { type: DataTypes.STRING(200) },
  payee_bank_account: { type: DataTypes.STRING(100) },
  payee_tin: { type: DataTypes.STRING(50) },
  payment_method: {
    type: DataTypes.ENUM('cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'),
    allowNull: false,
    defaultValue: 'bank_transfer',
  },
  payment_reference: { type: DataTypes.STRING(200) },
  description: { type: DataTypes.TEXT },
  currency: { type: DataTypes.STRING(3), defaultValue: 'MYR' },
  total_amount: { type: DataTypes.DECIMAL(15, 2), defaultValue: 0 },
  status: { type: DataTypes.ENUM('draft', 'approved', 'voided'), defaultValue: 'draft' },
  approved_at: { type: DataTypes.DATE },
  notes: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'payment_vouchers',
  timestamps: true,
  underscored: true,
});

export default PaymentVoucher;
