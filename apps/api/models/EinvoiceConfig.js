import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class EinvoiceConfig extends Model {}

EinvoiceConfig.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tin: { type: DataTypes.STRING(20) },
  client_id: { type: DataTypes.STRING(200) },
  client_secret_enc: { type: DataTypes.TEXT },
  is_sandbox: { type: DataTypes.BOOLEAN, defaultValue: true },
  is_enabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  cached_token: { type: DataTypes.TEXT },
  token_expires_at: { type: DataTypes.DATE },
  last_tested_at: { type: DataTypes.DATE },
  last_test_success: { type: DataTypes.BOOLEAN },
}, {
  sequelize,
  tableName: 'einvoice_configs',
  timestamps: true,
  underscored: true,
});

export default EinvoiceConfig;
