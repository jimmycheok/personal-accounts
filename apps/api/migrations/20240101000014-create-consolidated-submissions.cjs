'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('consolidated_submissions', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      submission_period: { type: Sequelize.STRING(7), allowNull: false },
      transaction_ids: { type: Sequelize.JSONB, defaultValue: [] },
      total_amount: { type: Sequelize.DECIMAL(15, 2) },
      submission_uid: { type: Sequelize.STRING(200) },
      document_uid: { type: Sequelize.STRING(200) },
      long_id: { type: Sequelize.STRING(500) },
      status: { type: Sequelize.ENUM('pending', 'valid', 'invalid', 'rejected', 'cancelled'), defaultValue: 'pending' },
      lhdn_response_raw: { type: Sequelize.JSONB },
      submitted_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('consolidated_submissions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_consolidated_submissions_status";');
  },
};
