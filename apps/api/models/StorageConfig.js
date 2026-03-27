import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class StorageConfig extends Model {}

StorageConfig.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  storage_type: { type: DataTypes.STRING(20), defaultValue: 'minio' },
  config_enc: { type: DataTypes.JSONB, defaultValue: {} },
  is_active: { type: DataTypes.BOOLEAN, defaultValue: true },
  last_tested_at: { type: DataTypes.DATE },
  last_test_success: { type: DataTypes.BOOLEAN },
}, {
  sequelize,
  tableName: 'storage_configs',
  timestamps: true,
  underscored: true,
});

export default StorageConfig;
