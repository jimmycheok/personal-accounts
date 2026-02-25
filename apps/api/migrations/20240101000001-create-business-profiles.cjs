'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('business_profiles', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      business_name: { type: Sequelize.STRING(200), allowNull: false },
      ssm_number: { type: Sequelize.STRING(50) },
      tin: { type: Sequelize.STRING(20) },
      msic_code: { type: Sequelize.STRING(10) },
      msic_description: { type: Sequelize.STRING(200) },
      address_line1: { type: Sequelize.STRING(200) },
      address_line2: { type: Sequelize.STRING(200) },
      city: { type: Sequelize.STRING(100) },
      postcode: { type: Sequelize.STRING(10) },
      state: { type: Sequelize.STRING(50) },
      country: { type: Sequelize.STRING(50), defaultValue: 'Malaysia' },
      phone: { type: Sequelize.STRING(20) },
      email: { type: Sequelize.STRING(200) },
      website: { type: Sequelize.STRING(200) },
      bank_name: { type: Sequelize.STRING(100) },
      bank_account_number: { type: Sequelize.STRING(50) },
      bank_account_name: { type: Sequelize.STRING(200) },
      logo_path: { type: Sequelize.STRING(500) },
      default_payment_terms: { type: Sequelize.INTEGER, defaultValue: 30 },
      default_currency: { type: Sequelize.STRING(3), defaultValue: 'MYR' },
      invoice_prefix: { type: Sequelize.STRING(10), defaultValue: 'INV' },
      quotation_prefix: { type: Sequelize.STRING(10), defaultValue: 'QUO' },
      setup_completed: { type: Sequelize.BOOLEAN, defaultValue: false },
      preferences: { type: Sequelize.JSONB, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('business_profiles');
  },
};
