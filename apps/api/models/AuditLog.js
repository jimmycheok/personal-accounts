import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class AuditLog extends Model {}

AuditLog.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  action: { type: DataTypes.STRING(100), allowNull: false },
  subject_type: { type: DataTypes.STRING(50), allowNull: false },
  subject_id: { type: DataTypes.STRING(50) },
  changes: { type: DataTypes.JSONB },
  user_id: { type: DataTypes.STRING(50) },
  ip_address: { type: DataTypes.STRING(50) },
  user_agent: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'audit_logs',
  timestamps: true,
  underscored: true,
  updatedAt: false,
});

export default AuditLog;
