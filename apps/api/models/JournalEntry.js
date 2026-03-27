import { DataTypes, Model } from 'sequelize';
import { sequelize } from '../config/database.js';

class JournalEntry extends Model {}

JournalEntry.init({
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  entry_date: { type: DataTypes.DATEONLY, allowNull: false },
  reference_number: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  description: { type: DataTypes.TEXT },
  is_auto: { type: DataTypes.BOOLEAN, defaultValue: false },
  source_type: { type: DataTypes.STRING(20) },
  source_id: { type: DataTypes.INTEGER },
  status: {
    type: DataTypes.ENUM('draft', 'posted'),
    allowNull: false,
    defaultValue: 'draft',
  },
  posted_at: { type: DataTypes.DATE },
}, {
  sequelize,
  tableName: 'journal_entries',
  timestamps: true,
  underscored: true,
});

export default JournalEntry;
