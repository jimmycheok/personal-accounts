'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('journal_entries', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      entry_date: { type: Sequelize.DATEONLY, allowNull: false },
      reference_number: { type: Sequelize.STRING(30), allowNull: false, unique: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      is_auto: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      source_type: { type: Sequelize.STRING(20), allowNull: true },
      source_id: { type: Sequelize.INTEGER, allowNull: true },
      status: {
        type: Sequelize.ENUM('draft', 'posted'),
        allowNull: false,
        defaultValue: 'draft',
      },
      posted_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('journal_entries', ['source_type', 'source_id']);
    await queryInterface.addIndex('journal_entries', ['entry_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('journal_entries');
  },
};
