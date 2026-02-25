'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('einvoice_configs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      tin: { type: Sequelize.STRING(20) },
      client_id: { type: Sequelize.STRING(200) },
      client_secret_enc: { type: Sequelize.TEXT },
      is_sandbox: { type: Sequelize.BOOLEAN, defaultValue: true },
      is_enabled: { type: Sequelize.BOOLEAN, defaultValue: false },
      cached_token: { type: Sequelize.TEXT },
      token_expires_at: { type: Sequelize.DATE },
      last_tested_at: { type: Sequelize.DATE },
      last_test_success: { type: Sequelize.BOOLEAN },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('einvoice_configs');
  },
};
