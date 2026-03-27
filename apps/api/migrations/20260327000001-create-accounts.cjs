'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('accounts', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      code: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      name: { type: Sequelize.STRING(200), allowNull: false },
      account_type: {
        type: Sequelize.ENUM('asset', 'liability', 'equity', 'revenue', 'expense'),
        allowNull: false,
      },
      sub_type: { type: Sequelize.STRING(50), allowNull: false },
      borang_b_section: { type: Sequelize.STRING(5), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      parent_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'accounts', key: 'id' },
        onDelete: 'SET NULL',
      },
      is_system: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('accounts', ['account_type']);
    await queryInterface.addIndex('accounts', ['borang_b_section']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('accounts');
  },
};
