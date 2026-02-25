'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('documents', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      subject_type: { type: Sequelize.STRING(50), allowNull: false },
      subject_id: { type: Sequelize.INTEGER, allowNull: false },
      storage_type: { type: Sequelize.ENUM('local', 'google_drive', 'aws_s3'), defaultValue: 'local' },
      storage_path: { type: Sequelize.STRING(1000), allowNull: false },
      file_name: { type: Sequelize.STRING(300), allowNull: false },
      original_name: { type: Sequelize.STRING(300) },
      mime_type: { type: Sequelize.STRING(100) },
      file_size: { type: Sequelize.BIGINT },
      storage_metadata: { type: Sequelize.JSONB, defaultValue: {} },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('documents', ['subject_type', 'subject_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('documents');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_documents_storage_type";');
  },
};
