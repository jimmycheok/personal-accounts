import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Account extends Model {}

Account.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  account_type: {
    type: DataTypes.ENUM('asset', 'liability', 'equity', 'revenue', 'expense'),
    allowNull: false,
  },
  sub_type: { type: DataTypes.STRING(50), allowNull: false },
  borang_b_section: { type: DataTypes.STRING(5) },
  description: { type: DataTypes.TEXT },
  parent_id: { type: DataTypes.INTEGER },
  is_system: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  tableName: 'accounts',
  timestamps: true,
  underscored: true,
});

export default Account;
