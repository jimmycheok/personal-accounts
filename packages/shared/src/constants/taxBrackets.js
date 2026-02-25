/**
 * Malaysian Personal Income Tax Brackets — AY2024 / AY2025
 * Chargeable Income in MYR
 * Source: LHDN / Budget 2024
 */
export const TAX_BRACKETS_AY2024 = [
  { min: 0,       max: 5000,    rate: 0,    flatTax: 0 },
  { min: 5001,    max: 20000,   rate: 0.01, flatTax: 0 },
  { min: 20001,   max: 35000,   rate: 0.03, flatTax: 150 },
  { min: 35001,   max: 50000,   rate: 0.06, flatTax: 600 },
  { min: 50001,   max: 70000,   rate: 0.11, flatTax: 1500 },
  { min: 70001,   max: 100000,  rate: 0.19, flatTax: 3700 },
  { min: 100001,  max: 250000,  rate: 0.25, flatTax: 9400 },
  { min: 250001,  max: 400000,  rate: 0.26, flatTax: 46900 },
  { min: 400001,  max: 600000,  rate: 0.28, flatTax: 85900 },
  { min: 600001,  max: 1000000, rate: 0.28, flatTax: 141900 },
  { min: 1000001, max: 2000000, rate: 0.30, flatTax: 253900 },
  { min: 2000001, max: Infinity, rate: 0.30, flatTax: 553900 },
];

// AY2025 uses same brackets — update when LHDN releases changes
export const TAX_BRACKETS_AY2025 = TAX_BRACKETS_AY2024;

export const TAX_BRACKETS = {
  2024: TAX_BRACKETS_AY2024,
  2025: TAX_BRACKETS_AY2025,
};

/**
 * Calculate chargeable income tax
 * @param {number} chargeableIncome - total chargeable income in MYR
 * @param {number} year - assessment year
 * @returns {{ tax: number, effectiveRate: number, breakdown: Array }}
 */
export function calculateTax(chargeableIncome, year = 2024) {
  const brackets = TAX_BRACKETS[year] || TAX_BRACKETS_AY2024;
  let tax = 0;
  const breakdown = [];

  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    if (chargeableIncome <= bracket.min) break;

    const taxableInBracket = Math.min(chargeableIncome, bracket.max) - bracket.min;
    const taxForBracket = taxableInBracket * bracket.rate;

    if (taxableInBracket > 0) {
      breakdown.push({
        min: bracket.min,
        max: bracket.max === Infinity ? null : bracket.max,
        rate: bracket.rate,
        taxableAmount: taxableInBracket,
        taxAmount: taxForBracket,
      });
      tax += taxForBracket;
    }
  }

  return {
    tax: Math.round(tax * 100) / 100,
    effectiveRate: chargeableIncome > 0 ? (tax / chargeableIncome) : 0,
    breakdown,
  };
}

/**
 * Standard personal reliefs for AY2024 (MYR)
 * Sole proprietor self-assessment
 */
export const STANDARD_RELIEFS_AY2024 = {
  selfRelief: 9000,
  spouseRelief: 4000,           // if spouse has no income
  disabilityRelief: 6000,
  lifestyleRelief: 2500,        // books, internet, sports equipment
  medicalRelief: 10000,         // serious diseases
  educationRelief: 7000,        // self education
  epfSocsoRelief: 4000,         // SOCSO contribution
  lifeInsuranceRelief: 7000,    // life insurance + EPF (combined max 7000)
  medicalInsuranceRelief: 3000, // medical/education insurance
  parentalCareRelief: 8000,     // medical expenses for parents
  childRelief: 2000,            // per child under 18
  childHigherEdRelief: 8000,    // per child in tertiary education
  breastfeedingRelief: 1000,
  childcareRelief: 3000,
  zakatRelief: null,            // zakat fully deductible (unlimited)
};

export const STANDARD_RELIEFS = {
  2024: STANDARD_RELIEFS_AY2024,
  2025: STANDARD_RELIEFS_AY2024, // same until updated
};
