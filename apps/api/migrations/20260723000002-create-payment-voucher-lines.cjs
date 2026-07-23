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
      // Free-text service item being paid for (e.g. "Logo design").
      // The GL account is decided in the GL modal at save time, not per line.
      service_item: { type: Sequelize.TEXT, allowNull: true },
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
