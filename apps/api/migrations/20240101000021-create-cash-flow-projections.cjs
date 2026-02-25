'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('cash_flow_projections', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      projection_date: { type: Sequelize.DATEONLY, allowNull: false, unique: true },
      projected_income: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      projected_expenses: { type: Sequelize.DECIMAL(15, 2), defaultValue: 0 },
      actual_income: { type: Sequelize.DECIMAL(15, 2) },
      actual_expenses: { type: Sequelize.DECIMAL(15, 2) },
      notes: { type: Sequelize.TEXT },
      generated_at: { type: Sequelize.DATE, defaultValue: Sequelize.NOW },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('cash_flow_projections');
  },
};
