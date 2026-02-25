'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('audit_logs', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      action: { type: Sequelize.STRING(100), allowNull: false },
      subject_type: { type: Sequelize.STRING(50), allowNull: false },
      subject_id: { type: Sequelize.STRING(50) },
      changes: { type: Sequelize.JSONB },
      user_id: { type: Sequelize.STRING(50) },
      ip_address: { type: Sequelize.STRING(50) },
      user_agent: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('audit_logs', ['subject_type', 'subject_id']);
    await queryInterface.addIndex('audit_logs', ['created_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('audit_logs');
  },
};
