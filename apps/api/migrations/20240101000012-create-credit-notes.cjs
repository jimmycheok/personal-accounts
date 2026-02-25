'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('credit_notes', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      credit_note_number: { type: Sequelize.STRING(50), unique: true, allowNull: false },
      invoice_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'invoices', key: 'id' } },
      issue_date: { type: Sequelize.DATEONLY, allowNull: false },
      reason: { type: Sequelize.TEXT },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      tax_amount: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      status: { type: Sequelize.ENUM('draft', 'submitted', 'valid', 'cancelled'), defaultValue: 'draft' },
      einvoice_long_id: { type: Sequelize.STRING(200) },
      notes: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('credit_notes');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_credit_notes_status";');
  },
};
