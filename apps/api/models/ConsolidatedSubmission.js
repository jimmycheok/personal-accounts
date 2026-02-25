import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class ConsolidatedSubmission extends Model {}

ConsolidatedSubmission.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  submission_period: { type: DataTypes.STRING(7), allowNull: false },
  transaction_ids: { type: DataTypes.JSONB, defaultValue: [] },
  total_amount: { type: DataTypes.DECIMAL(15, 2) },
  submission_uid: { type: DataTypes.STRING(200) },
  document_uid: { type: DataTypes.STRING(200) },
  long_id: { type: DataTypes.STRING(500) },
  status: { type: DataTypes.ENUM('pending', 'valid', 'invalid', 'rejected', 'cancelled'), defaultValue: 'pending' },
  lhdn_response_raw: { type: DataTypes.JSONB },
  submitted_at: { type: DataTypes.DATE },
}, {
  sequelize,
  tableName: 'consolidated_submissions',
  timestamps: true,
  underscored: true,
});

export default ConsolidatedSubmission;
