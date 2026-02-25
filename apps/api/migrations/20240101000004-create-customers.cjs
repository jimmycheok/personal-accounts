'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('customers', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      tin: { type: Sequelize.STRING(20) },
      id_type: { type: Sequelize.ENUM('NRIC', 'BRN', 'Passport', 'Army'), defaultValue: 'BRN' },
      id_value: { type: Sequelize.STRING(50) },
      customer_type: { type: Sequelize.ENUM('B2B', 'B2C', 'B2G'), defaultValue: 'B2B' },
      email: { type: Sequelize.STRING(200) },
      phone: { type: Sequelize.STRING(20) },
      address_line1: { type: Sequelize.STRING(200) },
      address_line2: { type: Sequelize.STRING(200) },
      city: { type: Sequelize.STRING(100) },
      postcode: { type: Sequelize.STRING(10) },
      state: { type: Sequelize.STRING(50) },
      country: { type: Sequelize.STRING(50), defaultValue: 'Malaysia' },
      notes: { type: Sequelize.TEXT },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('customers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_customers_id_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_customers_customer_type";');
  },
};
