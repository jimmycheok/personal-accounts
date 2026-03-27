'use strict';

const now = new Date();

const accounts = [
  // ── ASSETS (1000-series) ──
  { code: '1000', name: 'Cash on Hand', account_type: 'asset', sub_type: 'current_asset', borang_b_section: null, description: 'Physical cash held by the business', is_system: true, is_active: true },
  { code: '1010', name: 'Bank Account', account_type: 'asset', sub_type: 'current_asset', borang_b_section: null, description: 'Primary business bank account', is_system: true, is_active: true },
  { code: '1100', name: 'Accounts Receivable', account_type: 'asset', sub_type: 'current_asset', borang_b_section: null, description: 'Money owed by customers for invoiced goods/services', is_system: true, is_active: true },
  { code: '1200', name: 'Inventory', account_type: 'asset', sub_type: 'current_asset', borang_b_section: null, description: 'Stock on hand for resale', is_system: true, is_active: true },
  { code: '1300', name: 'Prepaid Expenses', account_type: 'asset', sub_type: 'current_asset', borang_b_section: null, description: 'Expenses paid in advance (rent, insurance, subscriptions)', is_system: true, is_active: true },
  { code: '1500', name: 'Office Equipment', account_type: 'asset', sub_type: 'fixed_asset', borang_b_section: null, description: 'Furniture, fittings, and office equipment', is_system: true, is_active: true },
  { code: '1510', name: 'Computer & IT Equipment', account_type: 'asset', sub_type: 'fixed_asset', borang_b_section: null, description: 'Computers, servers, networking equipment', is_system: true, is_active: true },
  { code: '1520', name: 'Motor Vehicle', account_type: 'asset', sub_type: 'fixed_asset', borang_b_section: null, description: 'Business motor vehicles', is_system: true, is_active: true },
  { code: '1599', name: 'Accumulated Depreciation', account_type: 'asset', sub_type: 'fixed_asset', borang_b_section: null, description: 'Contra asset — total depreciation charged on fixed assets', is_system: true, is_active: true },

  // ── LIABILITIES (2000-series) ──
  { code: '2000', name: 'Accounts Payable', account_type: 'liability', sub_type: 'current_liability', borang_b_section: null, description: 'Money owed to suppliers and vendors', is_system: true, is_active: true },
  { code: '2100', name: 'SST Payable', account_type: 'liability', sub_type: 'current_liability', borang_b_section: null, description: 'Sales & Service Tax collected, pending remittance to Customs', is_system: true, is_active: true },
  { code: '2200', name: 'Tax Payable', account_type: 'liability', sub_type: 'current_liability', borang_b_section: null, description: 'Income tax payable to LHDN', is_system: true, is_active: true },
  { code: '2300', name: 'Credit Card', account_type: 'liability', sub_type: 'current_liability', borang_b_section: null, description: 'Business credit card outstanding balance', is_system: true, is_active: true },
  { code: '2500', name: 'Business Loan', account_type: 'liability', sub_type: 'long_term_liability', borang_b_section: null, description: 'Bank or institutional loan for business purposes', is_system: true, is_active: true },

  // ── EQUITY (3000-series) ──
  { code: '3000', name: "Owner's Capital", account_type: 'equity', sub_type: 'equity', borang_b_section: null, description: 'Capital contributed by the sole proprietor', is_system: true, is_active: true },
  { code: '3100', name: "Owner's Drawings", account_type: 'equity', sub_type: 'equity', borang_b_section: null, description: 'Personal withdrawals by the owner (reduces equity)', is_system: true, is_active: true },
  { code: '3200', name: 'Retained Earnings', account_type: 'equity', sub_type: 'equity', borang_b_section: null, description: 'Accumulated net profit carried forward from prior years', is_system: true, is_active: true },

  // ── REVENUE (4000-series) ──
  { code: '4000', name: 'Sales Revenue', account_type: 'revenue', sub_type: 'revenue', borang_b_section: null, description: 'Income from invoiced goods and services', is_system: true, is_active: true },
  { code: '4100', name: 'Other Income', account_type: 'revenue', sub_type: 'other_income', borang_b_section: null, description: 'Interest income, rental income, gains on disposal, etc.', is_system: true, is_active: true },

  // ── COGS (5000-series) — Borang B D1 ──
  { code: '5000', name: 'Cost of Goods Sold', account_type: 'expense', sub_type: 'cogs', borang_b_section: 'D1', description: 'Direct costs of goods/services sold (raw materials, subcontractor)', is_system: true, is_active: true },

  // ── OPERATING EXPENSES (6000-series) — Borang B D2–D20 ──
  { code: '6100', name: 'Salaries & Wages', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D2', description: 'Employee salaries, EPF, SOCSO/EIS contributions', is_system: true, is_active: true },
  { code: '6200', name: 'Rental', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D3', description: 'Office, shop, or co-working space rental', is_system: true, is_active: true },
  { code: '6300', name: 'Repairs & Maintenance', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D4', description: 'Repairs to office, equipment, IT systems', is_system: true, is_active: true },
  { code: '6400', name: 'Motor Vehicle Expenses', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D5', description: 'Fuel, vehicle maintenance, toll, parking', is_system: true, is_active: true },
  { code: '6500', name: 'Travel & Accommodation', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D6', description: 'Business travel — flights, hotels, transport', is_system: true, is_active: true },
  { code: '6600', name: 'Communication', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D7', description: 'Phone, internet, postage', is_system: true, is_active: true },
  { code: '6700', name: 'Printing & Stationery', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D8', description: 'Printing, photocopying, stationery supplies', is_system: true, is_active: true },
  { code: '6800', name: 'Advertising & Promotion', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D9', description: 'Social media ads, Google/Meta, website costs', is_system: true, is_active: true },
  { code: '6900', name: 'Utilities', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D10', description: 'Electricity, water', is_system: true, is_active: true },
  { code: '6910', name: 'Insurance', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D11', description: 'Business insurance, fire & burglary coverage', is_system: true, is_active: true },
  { code: '6920', name: 'Professional Fees', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D12', description: 'Accounting, legal, consulting, tax agent fees', is_system: true, is_active: true },
  { code: '6930', name: 'Interest & Finance Charges', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D13', description: 'Bank loan interest, overdraft charges', is_system: true, is_active: true },
  { code: '6940', name: 'Capital Allowance', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D14', description: 'Depreciation on IT equipment, furniture, machinery', is_system: true, is_active: true },
  { code: '6950', name: 'Entertainment', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D15', description: 'Client entertainment, business meals, gifts (50% deductible)', is_system: true, is_active: true },
  { code: '6960', name: 'Training & Development', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D16', description: 'Staff training, courses, conferences', is_system: true, is_active: true },
  { code: '6970', name: 'Research & Development', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D17', description: 'R&D expenditure', is_system: true, is_active: true },
  { code: '6980', name: 'Donations (Approved)', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D18', description: 'Approved donations and zakat perniagaan', is_system: true, is_active: true },
  { code: '6990', name: 'Bad Debts', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D19', description: 'Bad debts written off', is_system: true, is_active: true },
  { code: '6999', name: 'Other Expenses', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: 'D20', description: 'SaaS subscriptions, bank charges, SSM registration, miscellaneous', is_system: true, is_active: true },
];

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const rows = accounts.map(a => ({ ...a, created_at: now, updated_at: now }));
    await queryInterface.bulkInsert('accounts', rows);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('accounts', null, {});
  },
};
