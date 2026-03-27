'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('journal_entry_lines', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      journal_entry_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'journal_entries', key: 'id' },
        onDelete: 'CASCADE',
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onDelete: 'RESTRICT',
      },
      debit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      credit: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      description: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('journal_entry_lines', ['journal_entry_id']);
    await queryInterface.addIndex('journal_entry_lines', ['account_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('journal_entry_lines');
  },
};
