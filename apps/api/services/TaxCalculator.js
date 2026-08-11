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
   * Display-only mileage estimate for a tax year — not a deduction (see
   * generateBorangBData). Note this uses a flat 0.25/km, which does not
   * match the log's own rate (routes/mileage.js stores km × 0.60 per
   * entry), a pre-existing inconsistency out of scope for this change. Now
   * that this figure is purely informational, it will visibly disagree with
   * the mileage log's own totals — left as-is per the mileage-logbook-only
   * task instructions.
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

    // Mileage is a logbook only — it posts no journal entry and is not a
    // deduction. D5 (Motor Vehicle Expenses) in sectionTotals comes solely
    // from actual vehicle receipts (fuel, repairs, insurance, road tax,
    // parking) recorded in Expenses, substantiated under s.33(1) ITA 1967 by
    // this log. `mileage` below is reported for display only — the owner's
    // own km × rate estimate — and is NOT added into sectionTotals.

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
