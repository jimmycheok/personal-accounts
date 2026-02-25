'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoices', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      invoice_number: { type: Sequelize.STRING(50), unique: true, allowNull: false },
      customer_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'customers', key: 'id' } },
      quotation_id: { type: Sequelize.INTEGER, references: { model: 'quotations', key: 'id' }, onDelete: 'SET NULL' },
      status: { type: Sequelize.ENUM('draft', 'sent', 'paid', 'overdue', 'cancelled', 'void'), defaultValue: 'draft' },
      issue_date: { type: Sequelize.DATEONLY, allowNull: false },
      due_date: { type: Sequelize.DATEONLY },
      currency: { type: Sequelize.STRING(3), defaultValue: 'MYR' },
      exchange_rate: { type: Sequelize.DECIMAL(10, 6), defaultValue: 1.0 },
      subtotal: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      tax_total: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      discount_total: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      amount_paid: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      amount_due: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      terms: { type: Sequelize.TEXT },
      sent_at: { type: Sequelize.DATE },
      paid_at: { type: Sequelize.DATE },
      void_reason: { type: Sequelize.TEXT },
      is_consolidated: { type: Sequelize.BOOLEAN, defaultValue: false },
      einvoice_long_id: { type: Sequelize.STRING(200) },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('invoices', ['customer_id']);
    await queryInterface.addIndex('invoices', ['status']);
    await queryInterface.addIndex('invoices', ['due_date']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('invoices');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_invoices_status";');
  },
};
