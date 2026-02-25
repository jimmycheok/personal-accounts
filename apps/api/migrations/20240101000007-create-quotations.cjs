'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('quotations', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      quotation_number: { type: Sequelize.STRING(50), unique: true, allowNull: false },
      customer_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'customers', key: 'id' } },
      status: { type: Sequelize.ENUM('draft', 'sent', 'accepted', 'rejected', 'expired'), defaultValue: 'draft' },
      issue_date: { type: Sequelize.DATEONLY, allowNull: false },
      expiry_date: { type: Sequelize.DATEONLY },
      converted_invoice_id: { type: Sequelize.INTEGER },
      currency: { type: Sequelize.STRING(3), defaultValue: 'MYR' },
      exchange_rate: { type: Sequelize.DECIMAL(10, 6), defaultValue: 1.0 },
      subtotal: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      tax_total: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      discount_total: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      total: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      notes: { type: Sequelize.TEXT },
      terms: { type: Sequelize.TEXT },
      sent_at: { type: Sequelize.DATE },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('quotations', ['customer_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('quotations');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_quotations_status";');
  },
};
