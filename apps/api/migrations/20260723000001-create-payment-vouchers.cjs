'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payment_vouchers', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true },
      pv_number: { type: Sequelize.STRING(30), allowNull: true, unique: true },
      pv_date: { type: Sequelize.DATEONLY, allowNull: false },
      payee_name: { type: Sequelize.STRING(200), allowNull: false },
      payee_bank_name: { type: Sequelize.STRING(200), allowNull: true },
      payee_bank_account: { type: Sequelize.STRING(100), allowNull: true },
      payee_tin: { type: Sequelize.STRING(50), allowNull: true },
      payment_method: {
        type: Sequelize.ENUM('cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'),
        allowNull: false,
        defaultValue: 'bank_transfer',
      },
      payment_reference: { type: Sequelize.STRING(200), allowNull: true },
      description: { type: Sequelize.TEXT, allowNull: true },
      currency: { type: Sequelize.STRING(3), allowNull: false, defaultValue: 'MYR' },
      total_amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0 },
      status: {
        type: Sequelize.ENUM('draft', 'approved', 'voided'),
        allowNull: false,
        defaultValue: 'draft',
      },
      approved_at: { type: Sequelize.DATE, allowNull: true },
      notes: { type: Sequelize.TEXT, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.addIndex('payment_vouchers', ['status']);
    await queryInterface.addIndex('payment_vouchers', ['pv_date']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('payment_vouchers');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_vouchers_payment_method";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payment_vouchers_status";');
  },
};
