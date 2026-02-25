import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class BusinessProfile extends Model {}

BusinessProfile.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  business_name: { type: DataTypes.STRING(200), allowNull: false },
  ssm_number: { type: DataTypes.STRING(50) },
  tin: { type: DataTypes.STRING(20) },
  msic_code: { type: DataTypes.STRING(10) },
  msic_description: { type: DataTypes.STRING(200) },
  address_line1: { type: DataTypes.STRING(200) },
  address_line2: { type: DataTypes.STRING(200) },
  city: { type: DataTypes.STRING(100) },
  postcode: { type: DataTypes.STRING(10) },
  state: { type: DataTypes.STRING(50) },
  country: { type: DataTypes.STRING(50), defaultValue: 'Malaysia' },
  phone: { type: DataTypes.STRING(20) },
  email: { type: DataTypes.STRING(200) },
  website: { type: DataTypes.STRING(200) },
  bank_name: { type: DataTypes.STRING(100) },
  bank_account_number: { type: DataTypes.STRING(50) },
  bank_account_name: { type: DataTypes.STRING(200) },
  logo_path: { type: DataTypes.STRING(500) },
  default_payment_terms: { type: DataTypes.INTEGER, defaultValue: 30 },
  default_currency: { type: DataTypes.STRING(3), defaultValue: 'MYR' },
  invoice_prefix: { type: DataTypes.STRING(10), defaultValue: 'INV' },
  quotation_prefix: { type: DataTypes.STRING(10), defaultValue: 'QUO' },
  setup_completed: { type: DataTypes.BOOLEAN, defaultValue: false },
  preferences: { type: DataTypes.JSONB, defaultValue: {} },
}, {
  sequelize,
  tableName: 'business_profiles',
  timestamps: true,
  underscored: true,
});

export default BusinessProfile;
