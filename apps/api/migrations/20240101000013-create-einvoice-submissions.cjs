'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('einvoice_submissions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      invoice_id: { type: Sequelize.INTEGER, references: { model: 'invoices', key: 'id' }, onDelete: 'SET NULL' },
      credit_note_id: { type: Sequelize.INTEGER, references: { model: 'credit_notes', key: 'id' }, onDelete: 'SET NULL' },
      submission_uid: { type: Sequelize.STRING(200) },
      document_uid: { type: Sequelize.STRING(200) },
      long_id: { type: Sequelize.STRING(500) },
      submission_type: { type: Sequelize.ENUM('invoice', 'credit_note', 'debit_note', 'self_billed', 'consolidated'), defaultValue: 'invoice' },
      status: { type: Sequelize.ENUM('pending', 'valid', 'invalid', 'rejected', 'cancelled'), defaultValue: 'pending' },
      lhdn_response_raw: { type: Sequelize.JSONB },
      submitted_at: { type: Sequelize.DATE },
      validated_at: { type: Sequelize.DATE },
      cancelled_at: { type: Sequelize.DATE },
      retry_count: { type: Sequelize.INTEGER, defaultValue: 0 },
      error_message: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('einvoice_submissions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_einvoice_submissions_submission_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_einvoice_submissions_status";');
  },
};
