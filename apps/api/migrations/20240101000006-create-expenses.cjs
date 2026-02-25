'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expenses', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      vendor_name: { type: Sequelize.STRING(200), allowNull: false },
      description: { type: Sequelize.TEXT },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      currency: { type: Sequelize.STRING(3), defaultValue: 'MYR' },
      exchange_rate: { type: Sequelize.DECIMAL(10, 6), defaultValue: 1.0 },
      amount_myr: { type: Sequelize.DECIMAL(15, 2) },
      expense_date: { type: Sequelize.DATEONLY, allowNull: false },
      category_id: { type: Sequelize.INTEGER, references: { model: 'expense_categories', key: 'id' }, onDelete: 'SET NULL' },
      is_tax_deductible: { type: Sequelize.BOOLEAN, defaultValue: true },
      tax_year: { type: Sequelize.INTEGER },
      ocr_confidence: { type: Sequelize.DECIMAL(5, 2) },
      ocr_raw: { type: Sequelize.JSONB },
      receipt_path: { type: Sequelize.STRING(500) },
      notes: { type: Sequelize.TEXT },
      is_recurring: { type: Sequelize.BOOLEAN, defaultValue: false },
      recurring_template_id: { type: Sequelize.INTEGER },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('expenses', ['expense_date']);
    await queryInterface.addIndex('expenses', ['tax_year']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('expenses');
  },
};
