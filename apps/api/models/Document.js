import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class Document extends Model {}

Document.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  subject_type: { type: DataTypes.STRING(50), allowNull: false },
  subject_id: { type: DataTypes.INTEGER, allowNull: false },
  storage_type: { type: DataTypes.ENUM('local', 'google_drive', 'aws_s3'), defaultValue: 'local' },
  storage_path: { type: DataTypes.STRING(1000), allowNull: false },
  file_name: { type: DataTypes.STRING(300), allowNull: false },
  original_name: { type: DataTypes.STRING(300) },
  mime_type: { type: DataTypes.STRING(100) },
  file_size: { type: DataTypes.BIGINT },
  storage_metadata: { type: DataTypes.JSONB, defaultValue: {} },
}, {
  sequelize,
  tableName: 'documents',
  timestamps: true,
  underscored: true,
});

export default Document;
