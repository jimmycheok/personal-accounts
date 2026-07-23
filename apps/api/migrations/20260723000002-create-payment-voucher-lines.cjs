'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_voucher_lines', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      payment_voucher_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'payment_vouchers', key: 'id' },
        onDelete: 'CASCADE',
      },
      account_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'accounts', key: 'id' },
        onDelete: 'RESTRICT',
      },
      description: { type: Sequelize.TEXT, allowNull: true },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('payment_voucher_lines', ['payment_voucher_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_voucher_lines');
  },
};
