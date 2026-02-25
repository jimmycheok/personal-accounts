'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mileage_logs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      log_date: { type: Sequelize.DATEONLY, allowNull: false },
      from_location: { type: Sequelize.STRING(300) },
      to_location: { type: Sequelize.STRING(300) },
      purpose: { type: Sequelize.TEXT, allowNull: false },
      km: { type: Sequelize.DECIMAL(8, 2), allowNull: false },
      rate_per_km: { type: Sequelize.DECIMAL(6, 4), defaultValue: 0.25 },
      deductible_amount: { type: Sequelize.DECIMAL(10, 2) },
      tax_year: { type: Sequelize.INTEGER },
      notes: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('mileage_logs', ['tax_year']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('mileage_logs');
  },
};
