/**
 * Borang B (BE) — Part D Expense Sections
 * Maps expense categories to Borang B sections D1–D20
 * Used for Malaysian sole proprietor tax return
 */

export const BORANG_B_SECTIONS = {
  D1:  { code: 'D1',  label: 'Purchase of goods / direct materials' },
  D2:  { code: 'D2',  label: 'Salaries, wages, EPF & SOCSO' },
  D3:  { code: 'D3',  label: 'Rental of premises' },
  D4:  { code: 'D4',  label: 'Repairs and maintenance' },
  D5:  { code: 'D5',  label: 'Motor vehicle expenses' },
  D6:  { code: 'D6',  label: 'Travelling and accommodation' },
  D7:  { code: 'D7',  label: 'Postage, telephone, internet' },
  D8:  { code: 'D8',  label: 'Printing and stationery' },
  D9:  { code: 'D9',  label: 'Advertising and promotion' },
  D10: { code: 'D10', label: 'Utilities (electricity, water, gas)' },
  D11: { code: 'D11', label: 'Insurance and security' },
  D12: { code: 'D12', label: 'Professional fees (legal, audit, consulting)' },
  D13: { code: 'D13', label: 'Interest charges on business loans' },
  D14: { code: 'D14', label: 'Depreciation / capital allowance' },
  D15: { code: 'D15', label: 'Entertainment (50% deductible)', deductibilityRate: 0.5 },
  D16: { code: 'D16', label: 'Training and staff development' },
  D17: { code: 'D17', label: 'Research and development' },
  D18: { code: 'D18', label: 'Donations and contributions (approved)' },
  D19: { code: 'D19', label: 'Bad debts written off' },
  D20: { code: 'D20', label: 'Other allowable expenses' },
};

/**
 * Suggested expense category → Borang B section mappings
 * Used for auto-mapping when creating expense categories
 */
export const DEFAULT_EXPENSE_CATEGORIES = [
  // D1 — Cost of Goods
  { name: 'Raw Materials / Stock', borang_b_section: 'D1', is_tax_deductible: true },
  { name: 'Subcontractor / Outsourced Work', borang_b_section: 'D1', is_tax_deductible: true },

  // D2 — Salaries
  { name: 'Salaries & Wages', borang_b_section: 'D2', is_tax_deductible: true },
  { name: 'EPF Contribution', borang_b_section: 'D2', is_tax_deductible: true },
  { name: 'SOCSO / EIS Contribution', borang_b_section: 'D2', is_tax_deductible: true },
  { name: 'Bonus & Allowances', borang_b_section: 'D2', is_tax_deductible: true },

  // D3 — Rental
  { name: 'Office / Shop Rental', borang_b_section: 'D3', is_tax_deductible: true },
  { name: 'Warehouse / Storage Rental', borang_b_section: 'D3', is_tax_deductible: true },
  { name: 'Co-working Space', borang_b_section: 'D3', is_tax_deductible: true },

  // D4 — Repairs
  { name: 'Office Repairs & Maintenance', borang_b_section: 'D4', is_tax_deductible: true },
  { name: 'Equipment Repairs', borang_b_section: 'D4', is_tax_deductible: true },
  { name: 'IT / Computer Maintenance', borang_b_section: 'D4', is_tax_deductible: true },

  // D5 — Motor Vehicle
  { name: 'Petrol / Fuel', borang_b_section: 'D5', is_tax_deductible: true },
  { name: 'Vehicle Maintenance', borang_b_section: 'D5', is_tax_deductible: true },
  { name: 'Toll & Parking', borang_b_section: 'D5', is_tax_deductible: true },

  // D6 — Travel
  { name: 'Flight Tickets', borang_b_section: 'D6', is_tax_deductible: true },
  { name: 'Hotel / Accommodation', borang_b_section: 'D6', is_tax_deductible: true },
  { name: 'Grab / Taxi (Business)', borang_b_section: 'D6', is_tax_deductible: true },

  // D7 — Communications
  { name: 'Telephone / Mobile Bills', borang_b_section: 'D7', is_tax_deductible: true },
  { name: 'Internet Bills', borang_b_section: 'D7', is_tax_deductible: true },
  { name: 'Postage & Courier', borang_b_section: 'D7', is_tax_deductible: true },

  // D8 — Printing
  { name: 'Printing & Photocopying', borang_b_section: 'D8', is_tax_deductible: true },
  { name: 'Office Stationery', borang_b_section: 'D8', is_tax_deductible: true },

  // D9 — Advertising
  { name: 'Social Media Ads', borang_b_section: 'D9', is_tax_deductible: true },
  { name: 'Google / Meta Advertising', borang_b_section: 'D9', is_tax_deductible: true },
  { name: 'Printing / Brochures / Banners', borang_b_section: 'D9', is_tax_deductible: true },
  { name: 'Website & Domain', borang_b_section: 'D9', is_tax_deductible: true },

  // D10 — Utilities
  { name: 'Electricity Bill', borang_b_section: 'D10', is_tax_deductible: true },
  { name: 'Water Bill', borang_b_section: 'D10', is_tax_deductible: true },

  // D11 — Insurance
  { name: 'Business Insurance', borang_b_section: 'D11', is_tax_deductible: true },
  { name: 'Fire / Burglary Insurance', borang_b_section: 'D11', is_tax_deductible: true },

  // D12 — Professional Fees
  { name: 'Accounting / Audit Fees', borang_b_section: 'D12', is_tax_deductible: true },
  { name: 'Legal Fees', borang_b_section: 'D12', is_tax_deductible: true },
  { name: 'Consulting Fees', borang_b_section: 'D12', is_tax_deductible: true },
  { name: 'Tax Agent Fees', borang_b_section: 'D12', is_tax_deductible: true },

  // D13 — Interest
  { name: 'Bank Loan Interest', borang_b_section: 'D13', is_tax_deductible: true },
  { name: 'Overdraft Interest', borang_b_section: 'D13', is_tax_deductible: true },

  // D14 — Depreciation
  { name: 'Computer / IT Equipment', borang_b_section: 'D14', is_capital_allowance: true, is_tax_deductible: true },
  { name: 'Office Furniture', borang_b_section: 'D14', is_capital_allowance: true, is_tax_deductible: true },
  { name: 'Machinery / Tools', borang_b_section: 'D14', is_capital_allowance: true, is_tax_deductible: true },

  // D15 — Entertainment (50%)
  { name: 'Client Entertainment', borang_b_section: 'D15', is_tax_deductible: true },
  { name: 'Business Meals', borang_b_section: 'D15', is_tax_deductible: true },
  { name: 'Corporate Gifts', borang_b_section: 'D15', is_tax_deductible: true },

  // D16 — Training
  { name: 'Staff Training', borang_b_section: 'D16', is_tax_deductible: true },
  { name: 'Online Courses / Certifications', borang_b_section: 'D16', is_tax_deductible: true },
  { name: 'Conference / Seminar Fees', borang_b_section: 'D16', is_tax_deductible: true },

  // D17 — R&D
  { name: 'Research & Development', borang_b_section: 'D17', is_tax_deductible: true },

  // D18 — Donations
  { name: 'Approved Donations', borang_b_section: 'D18', is_tax_deductible: true },
  { name: 'Zakat Perniagaan', borang_b_section: 'D18', is_tax_deductible: true },

  // D19 — Bad Debts
  { name: 'Bad Debts Written Off', borang_b_section: 'D19', is_tax_deductible: true },

  // D20 — Others
  { name: 'Software Subscriptions (SaaS)', borang_b_section: 'D20', is_tax_deductible: true },
  { name: 'Bank Charges & Fees', borang_b_section: 'D20', is_tax_deductible: true },
  { name: 'SSM Registration / Annual Fee', borang_b_section: 'D20', is_tax_deductible: true },
  { name: 'Other Business Expenses', borang_b_section: 'D20', is_tax_deductible: true },
  { name: 'Personal / Non-deductible', borang_b_section: null, is_tax_deductible: false },
];
