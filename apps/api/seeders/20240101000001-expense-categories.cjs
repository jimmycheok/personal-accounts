'use strict';

const categories = [
  // D1 — Cost of Goods
  { name: 'Raw Materials / Stock', borang_b_section: 'D1', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 1 },
  { name: 'Subcontractor / Outsourced Work', borang_b_section: 'D1', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 2 },

  // D2 — Salaries
  { name: 'Salaries & Wages', borang_b_section: 'D2', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 3 },
  { name: 'EPF Contribution', borang_b_section: 'D2', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 4 },
  { name: 'SOCSO / EIS Contribution', borang_b_section: 'D2', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 5 },

  // D3 — Rental
  { name: 'Office / Shop Rental', borang_b_section: 'D3', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 6 },
  { name: 'Co-working Space', borang_b_section: 'D3', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 7 },

  // D4 — Repairs
  { name: 'Office Repairs & Maintenance', borang_b_section: 'D4', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 8 },
  { name: 'Equipment Repairs', borang_b_section: 'D4', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 9 },
  { name: 'IT / Computer Maintenance', borang_b_section: 'D4', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 10 },

  // D5 — Motor Vehicle
  { name: 'Petrol / Fuel', borang_b_section: 'D5', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 11 },
  { name: 'Vehicle Maintenance', borang_b_section: 'D5', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 12 },
  { name: 'Toll & Parking', borang_b_section: 'D5', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 13 },

  // D6 — Travel
  { name: 'Flight Tickets', borang_b_section: 'D6', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 14 },
  { name: 'Hotel / Accommodation', borang_b_section: 'D6', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 15 },
  { name: 'Grab / Taxi (Business)', borang_b_section: 'D6', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 16 },

  // D7 — Communications
  { name: 'Telephone / Mobile Bills', borang_b_section: 'D7', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 17 },
  { name: 'Internet Bills', borang_b_section: 'D7', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 18 },
  { name: 'Postage & Courier', borang_b_section: 'D7', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 19 },

  // D8 — Printing
  { name: 'Printing & Photocopying', borang_b_section: 'D8', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 20 },
  { name: 'Office Stationery', borang_b_section: 'D8', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 21 },

  // D9 — Advertising
  { name: 'Social Media Advertising', borang_b_section: 'D9', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 22 },
  { name: 'Google / Meta Advertising', borang_b_section: 'D9', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 23 },
  { name: 'Website & Domain Costs', borang_b_section: 'D9', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 24 },

  // D10 — Utilities
  { name: 'Electricity Bill', borang_b_section: 'D10', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 25 },
  { name: 'Water Bill', borang_b_section: 'D10', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 26 },

  // D11 — Insurance
  { name: 'Business Insurance', borang_b_section: 'D11', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 27 },
  { name: 'Fire / Burglary Insurance', borang_b_section: 'D11', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 28 },

  // D12 — Professional Fees
  { name: 'Accounting / Audit Fees', borang_b_section: 'D12', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 29 },
  { name: 'Legal Fees', borang_b_section: 'D12', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 30 },
  { name: 'Consulting Fees', borang_b_section: 'D12', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 31 },
  { name: 'Tax Agent Fees', borang_b_section: 'D12', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 32 },

  // D13 — Interest
  { name: 'Bank Loan Interest', borang_b_section: 'D13', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 33 },
  { name: 'Overdraft Interest', borang_b_section: 'D13', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 34 },

  // D14 — Depreciation / Capital Allowance
  { name: 'Computer / IT Equipment', borang_b_section: 'D14', is_capital_allowance: true, is_tax_deductible: true, is_system: true, sort_order: 35 },
  { name: 'Office Furniture', borang_b_section: 'D14', is_capital_allowance: true, is_tax_deductible: true, is_system: true, sort_order: 36 },
  { name: 'Machinery / Tools', borang_b_section: 'D14', is_capital_allowance: true, is_tax_deductible: true, is_system: true, sort_order: 37 },

  // D15 — Entertainment (50% deductible)
  { name: 'Client Entertainment', borang_b_section: 'D15', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 38 },
  { name: 'Business Meals', borang_b_section: 'D15', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 39 },
  { name: 'Corporate Gifts', borang_b_section: 'D15', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 40 },

  // D16 — Training
  { name: 'Staff Training', borang_b_section: 'D16', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 41 },
  { name: 'Online Courses / Certifications', borang_b_section: 'D16', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 42 },
  { name: 'Conference / Seminar Fees', borang_b_section: 'D16', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 43 },

  // D17 — R&D
  { name: 'Research & Development', borang_b_section: 'D17', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 44 },

  // D18 — Donations
  { name: 'Approved Donations', borang_b_section: 'D18', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 45 },
  { name: 'Zakat Perniagaan', borang_b_section: 'D18', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 46 },

  // D19 — Bad Debts
  { name: 'Bad Debts Written Off', borang_b_section: 'D19', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 47 },

  // D20 — Other
  { name: 'Software Subscriptions (SaaS)', borang_b_section: 'D20', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 48 },
  { name: 'Bank Charges & Fees', borang_b_section: 'D20', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 49 },
  { name: 'SSM Registration / Annual Fee', borang_b_section: 'D20', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 50 },
  { name: 'Other Business Expenses', borang_b_section: 'D20', is_capital_allowance: false, is_tax_deductible: true, is_system: true, sort_order: 51 },

  // Non-deductible
  { name: 'Personal / Non-deductible', borang_b_section: null, is_capital_allowance: false, is_tax_deductible: false, is_system: true, sort_order: 99 },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert('expense_categories', categories.map(c => ({
      ...c,
      parent_id: null,
      created_at: now,
      updated_at: now,
    })));
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('expense_categories', { is_system: true });
  },
};
