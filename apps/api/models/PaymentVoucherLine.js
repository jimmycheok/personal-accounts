import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class PaymentVoucherLine extends Model {}

PaymentVoucherLine.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  payment_voucher_id: { type: DataTypes.INTEGER, allowNull: false },
  account_id: { type: DataTypes.INTEGER, allowNull: false },
  description: { type: DataTypes.TEXT },
  amount: { type: DataTypes.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
}, {
  sequelize,
  tableName: 'payment_voucher_lines',
  timestamps: true,
  underscored: true,
});

export default PaymentVoucherLine;
