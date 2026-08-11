'use strict';

/** Mileage claims and actual vehicle receipts (fuel, maintenance, toll/parking)
 *  both fund Borang B section D5 but must never share one account: a per-km
 *  mileage rate substitutes for actual costs, so recording both for the same
 *  trip would deduct it twice. Splitting the postings makes that overlap
 *  visible (see LedgerQueryService.getMileageOverlapByMonth) while keeping
 *  the D5 total unchanged — 6410 carries the same borang_b_section as 6400. */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      "SELECT id FROM accounts WHERE code = '6410'",
    );
    if (existing.length) return;

    await queryInterface.bulkInsert('accounts', [{
      code: '6410',
      name: 'Mileage Claim',
      account_type: 'expense',
      sub_type: 'operating_expense',
      borang_b_section: 'D5',
      description: 'Per-km mileage claims for business trips, kept separate from actual vehicle receipts (6400) so double-claiming the same trip is visible',
      is_system: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('accounts', { code: '6410' });
  },
};
