'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_statement_rows', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      bank_statement_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'bank_statements', key: 'id' }, onDelete: 'CASCADE' },
      transaction_date: { type: Sequelize.DATEONLY },
      description: { type: Sequelize.TEXT },
      reference: { type: Sequelize.STRING(200) },
      debit: { type: Sequelize.DECIMAL(15, 2) },
      credit: { type: Sequelize.DECIMAL(15, 2) },
      balance: { type: Sequelize.DECIMAL(15, 2) },
      matched_type: { type: Sequelize.STRING(50) },
      matched_id: { type: Sequelize.INTEGER },
      is_reconciled: { type: Sequelize.BOOLEAN, defaultValue: false },
      notes: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('bank_statement_rows', ['bank_statement_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('bank_statement_rows');
  },
};
