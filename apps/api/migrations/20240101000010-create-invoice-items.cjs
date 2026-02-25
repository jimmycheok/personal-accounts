'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('invoice_items', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      invoice_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'invoices', key: 'id' }, onDelete: 'CASCADE' },
      description: { type: Sequelize.TEXT, allowNull: false },
      quantity: { type: Sequelize.DECIMAL(10, 3), defaultValue: 1 },
      unit_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      tax_rate: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      discount_rate: { type: Sequelize.DECIMAL(5, 2), defaultValue: 0 },
      subtotal: { type: Sequelize.DECIMAL(15, 2) },
      tax_amount: { type: Sequelize.DECIMAL(15, 2) },
      total: { type: Sequelize.DECIMAL(15, 2) },
      classification_code: { type: Sequelize.STRING(20) },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('invoice_items');
  },
};
