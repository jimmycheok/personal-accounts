import { Op } from 'sequelize';
import { Invoice, InvoiceItem, MileageLog } from '../models/index.js';
import { calculateTax, STANDARD_RELIEFS } from '@personal-accountant/shared/constants/taxBrackets';
import { BORANG_B_SECTIONS } from '@personal-accountant/shared/constants/borangBMapping';
import LedgerQueryService from './LedgerQueryService.js';

class TaxCalculator {
  /**
   * Get total income (paid invoices) for a tax year
   */
  async getIncomeForYear(year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const invoices = await Invoice.findAll({
      where: {
        status: 'paid',
        paid_at: { [Op.between]: [startDate, endDate] },
      },
      attributes: ['id', 'invoice_number', 'total', 'paid_at', 'customer_id', 'currency'],
    });

    const totalIncome = invoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
    return { invoices, totalIncome };
  }

  /**
   * Deductible expenses grouped by Borang B section, read from the general
   * ledger so payment vouchers and journal entries count alongside expenses.
   * Accounts with no borang_b_section (6995 Non-Deductible) are excluded.
   * D15 Entertainment is halved by applySectionRules.
   */
  async getExpensesBySection(year) {
    const sectionTotals = await LedgerQueryService.getExpensesBySection(
      `${year}-01-01`,
      `${year}-12-31`,
    );
    return { sectionTotals };
  }

  /**
   * Get mileage deduction for a tax year
   */
  async getMileageDeduction(year) {
    const { MileageLog: ML } = await import('../models/index.js');
    const logs = await MileageLog.findAll({ where: { tax_year: year } });
    const totalKm = logs.reduce((sum, l) => sum + parseFloat(l.km), 0);
    const deductibleAmount = totalKm * 0.25;
    return { totalKm, deductibleAmount };
  }

  /**
   * Generate full Borang B data for a year.
   *
   * Income is now GL-sourced (accrual), not the `invoices.paid_at`
   * cash-received figure `getIncomeForYear` returns. Two reasons:
   *   1. A manual journal entry crediting 4000 (Sales Revenue) counted in
   *      the P&L but not here, while a manual entry debiting an expense
   *      account counted as a deduction here — the two sides disagreed.
   *   2. `paid_at` is a timestamp compared against plain 'Y-01-01'/'Y-12-31'
   *      strings (no time component), so an invoice paid on Dec 31 could
   *      fall outside the range depending on time-of-day, while
   *      `/taxation/income-summary` handles that boundary correctly with
   *      `T23:59:59`. GL entry_date is a DATEONLY column compared with
   *      BETWEEN, which has no such boundary problem.
   * `getIncomeForYear` is still called for `partB.invoiceCount` (display
   * metadata only — not used in the tax calculation below).
   */
  async generateBorangBData(year) {
    const { invoices } = await this.getIncomeForYear(year);
    const totalIncome = await LedgerQueryService.getIncomeTotal(`${year}-01-01`, `${year}-12-31`);
    const { sectionTotals } = await this.getExpensesBySection(year);
    const { totalKm, deductibleAmount: mileageDeduction } = await this.getMileageDeduction(year);
    const mileageOverlapMonths = await LedgerQueryService.getMileageOverlapByMonth(`${year}-01-01`, `${year}-12-31`);

    // The GL is authoritative: mileage logs post their own journal entry
    // (debit 6410 Mileage Claim, which carries borang_b_section 'D5' just
    // like 6400 Motor Vehicle Expenses used for actual receipts), so
    // getExpensesBySection already includes mileage. Adding mileageDeduction
    // here would double-count it under a different rate.
    // `mileage` below is reported for display only — it is NOT added into
    // sectionTotals.

    const totalExpenses = Object.values(sectionTotals).reduce((sum, v) => sum + v, 0);
    const grossProfit = totalIncome - totalExpenses;

    return {
      year,
      partB: {
        grossIncome: totalIncome,
        invoiceCount: invoices.length,
      },
      partD: {
        sections: Object.entries(BORANG_B_SECTIONS).map(([code, section]) => ({
          code,
          label: section.label,
          amount: Math.round(sectionTotals[code] * 100) / 100,
        })),
        totalExpenses: Math.round(totalExpenses * 100) / 100,
      },
      grossProfit: Math.round(grossProfit * 100) / 100,
      mileage: { totalKm, deductibleAmount: mileageDeduction },
      // Months where both actual vehicle receipts (6400) and mileage claims
      // (6410) were posted — informational only, see
      // LedgerQueryService.getMileageOverlapByMonth.
      mileageOverlapMonths,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * Estimate tax payable for a year given reliefs
   */
  async estimateTax(year, reliefs = {}) {
    const borangB = await this.generateBorangBData(year);
    const grossProfit = borangB.grossProfit;

    const standardReliefs = STANDARD_RELIEFS[year] || STANDARD_RELIEFS[2024];
    const totalReliefs = Object.entries(reliefs).reduce((sum, [key, val]) => {
      return sum + (parseFloat(val) || 0);
    }, 0);

    const chargeableIncome = Math.max(0, grossProfit - totalReliefs);
    const { tax, effectiveRate, breakdown } = calculateTax(chargeableIncome, year);

    return {
      year,
      grossProfit,
      totalReliefs,
      chargeableIncome,
      estimatedTax: tax,
      effectiveRate,
      breakdown,
      borangB,
      reliefs: { ...standardReliefs, ...reliefs },
    };
  }
}

export default new TaxCalculator();
