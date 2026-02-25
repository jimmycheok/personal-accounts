'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('storage_configs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      storage_type: { type: Sequelize.ENUM('local', 'google_drive', 'aws_s3'), defaultValue: 'local' },
      config_enc: { type: Sequelize.JSONB, defaultValue: {} },
      is_active: { type: Sequelize.BOOLEAN, defaultValue: true },
      last_tested_at: { type: Sequelize.DATE },
      last_test_success: { type: Sequelize.BOOLEAN },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('storage_configs');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_storage_configs_storage_type";');
  },
};
