'use strict';

/** Expenses that are real business costs but not claimable against tax.
 *  borang_b_section is NULL so GL-sourced tax queries skip it automatically. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM accounts WHERE code = '6995'",
    );
    if (existing.length) return;

    await queryInterface.bulkInsert('accounts', [{
      code: '6995',
      name: 'Non-Deductible Expenses',
      account_type: 'expense',
      sub_type: 'operating_expense',
      borang_b_section: null,
      description: 'Business costs that are not claimable against income tax',
      is_system: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('accounts', { code: '6995' });
  },
};
