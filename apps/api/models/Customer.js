import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Customer extends Model {}

Customer.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.STRING(200), allowNull: false },
  tin: { type: DataTypes.STRING(20) },
  id_type: { type: DataTypes.ENUM('NRIC', 'BRN', 'Passport', 'Army'), defaultValue: 'BRN' },
  id_value: { type: DataTypes.STRING(50) },
  customer_type: { type: DataTypes.ENUM('B2B', 'B2C', 'B2G'), defaultValue: 'B2B' },
  email: { type: DataTypes.STRING(200) },
  phone: { type: DataTypes.STRING(20) },
  address_line1: { type: DataTypes.STRING(200) },
  address_line2: { type: DataTypes.STRING(200) },
  city: { type: DataTypes.STRING(100) },
  postcode: { type: DataTypes.STRING(10) },
  state: { type: DataTypes.STRING(50) },
  country: { type: DataTypes.STRING(50), defaultValue: 'Malaysia' },
  notes: { type: DataTypes.TEXT },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
}, {
  sequelize,
  tableName: 'customers',
  timestamps: true,
  underscored: true,
});

export default Customer;
