'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('expense_categories', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      borang_b_section: { type: Sequelize.STRING(5) },
      is_capital_allowance: { type: Sequelize.BOOLEAN, defaultValue: false },
      is_tax_deductible: { type: Sequelize.BOOLEAN, defaultValue: true },
      parent_id: { type: Sequelize.INTEGER, references: { model: 'expense_categories', key: 'id' }, onDelete: 'SET NULL' },
      is_system: { type: Sequelize.BOOLEAN, defaultValue: false },
      sort_order: { type: Sequelize.INTEGER, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('expense_categories');
  },
};
