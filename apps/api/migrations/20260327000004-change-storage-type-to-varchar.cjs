'use strict';

module.exports = {
  async up(queryInterface) {
    // Convert ENUM columns to VARCHAR using raw SQL (Sequelize changeColumn can't cast ENUM → VARCHAR directly)
    await queryInterface.sequelize.query(`
      ALTER TABLE documents
        ALTER COLUMN storage_type DROP DEFAULT,
        ALTER COLUMN storage_type TYPE VARCHAR(20) USING storage_type::text,
        ALTER COLUMN storage_type SET DEFAULT 'minio';
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE storage_configs
        ALTER COLUMN storage_type DROP DEFAULT,
        ALTER COLUMN storage_type TYPE VARCHAR(20) USING storage_type::text,
        ALTER COLUMN storage_type SET DEFAULT 'minio';
    `);

    // Update existing rows from 'local' to 'minio'
    await queryInterface.sequelize.query(
      `UPDATE documents SET storage_type = 'minio' WHERE storage_type = 'local'`
    );
    await queryInterface.sequelize.query(
      `UPDATE storage_configs SET storage_type = 'minio' WHERE storage_type = 'local'`
    );

    // Drop the old enum types
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_documents_storage_type"');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_storage_configs_storage_type"');
  },

  async down(queryInterface, Sequelize) {
    // Revert to ENUM
    await queryInterface.sequelize.query(
      `UPDATE documents SET storage_type = 'local' WHERE storage_type = 'minio'`
    );
    await queryInterface.sequelize.query(
      `UPDATE storage_configs SET storage_type = 'local' WHERE storage_type = 'minio'`
    );

    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_documents_storage_type" AS ENUM ('local', 'google_drive', 'aws_s3');
      ALTER TABLE documents
        ALTER COLUMN storage_type DROP DEFAULT,
        ALTER COLUMN storage_type TYPE "enum_documents_storage_type" USING storage_type::"enum_documents_storage_type",
        ALTER COLUMN storage_type SET DEFAULT 'local';
    `);
    await queryInterface.sequelize.query(`
      CREATE TYPE "enum_storage_configs_storage_type" AS ENUM ('local', 'google_drive', 'aws_s3');
      ALTER TABLE storage_configs
        ALTER COLUMN storage_type DROP DEFAULT,
        ALTER COLUMN storage_type TYPE "enum_storage_configs_storage_type" USING storage_type::"enum_storage_configs_storage_type",
        ALTER COLUMN storage_type SET DEFAULT 'local';
    `);
  },
};
