'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_statements', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bank_name: { type: Sequelize.STRING(100) },
      account_number: { type: Sequelize.STRING(50) },
      statement_period_start: { type: Sequelize.DATEONLY },
      statement_period_end: { type: Sequelize.DATEONLY },
      opening_balance: { type: Sequelize.DECIMAL(15, 2) },
      closing_balance: { type: Sequelize.DECIMAL(15, 2) },
      file_name: { type: Sequelize.STRING(300) },
      import_status: { type: Sequelize.ENUM('imported', 'partial', 'reconciled'), defaultValue: 'imported' },
      total_rows: { type: Sequelize.INTEGER, defaultValue: 0 },
      matched_rows: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('bank_statements');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bank_statements_import_status";');
  },
};
