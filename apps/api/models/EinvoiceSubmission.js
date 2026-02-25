import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class EinvoiceSubmission extends Model {}

EinvoiceSubmission.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  invoice_id: { type: DataTypes.INTEGER },
  credit_note_id: { type: DataTypes.INTEGER },
  submission_uid: { type: DataTypes.STRING(200) },
  document_uid: { type: DataTypes.STRING(200) },
  long_id: { type: DataTypes.STRING(500) },
  submission_type: { type: DataTypes.ENUM('invoice', 'credit_note', 'debit_note', 'self_billed', 'consolidated'), defaultValue: 'invoice' },
  status: { type: DataTypes.ENUM('pending', 'valid', 'invalid', 'rejected', 'cancelled'), defaultValue: 'pending' },
  lhdn_response_raw: { type: DataTypes.JSONB },
  submitted_at: { type: DataTypes.DATE },
  validated_at: { type: DataTypes.DATE },
  cancelled_at: { type: DataTypes.DATE },
  retry_count: { type: DataTypes.INTEGER, defaultValue: 0 },
  error_message: { type: DataTypes.TEXT },
}, {
  sequelize,
  tableName: 'einvoice_submissions',
  timestamps: true,
  underscored: true,
});

export default EinvoiceSubmission;
