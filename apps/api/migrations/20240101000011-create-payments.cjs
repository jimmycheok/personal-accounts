'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('payments', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      invoice_id: { type: Sequelize.INTEGER, allowNull: false, references: { model: 'invoices', key: 'id' }, onDelete: 'CASCADE' },
      payment_date: { type: Sequelize.DATEONLY, allowNull: false },
      amount: { type: Sequelize.DECIMAL(15, 2), allowNull: false },
      method: { type: Sequelize.ENUM('cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'), defaultValue: 'bank_transfer' },
      reference: { type: Sequelize.STRING(200) },
      notes: { type: Sequelize.TEXT },
      created_at: { type: Sequelize.DATE, allowNull: false },
      updated_at: { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('payments');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_payments_method";');
  },
};
