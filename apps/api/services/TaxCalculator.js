import { Op } from 'sequelize';
import { Invoice, InvoiceItem, Expense, ExpenseCategory, MileageLog } from '../models/index.js';
import { calculateTax, STANDARD_RELIEFS } from '@personal-accountant/shared/constants/taxBrackets.js';
import { BORANG_B_SECTIONS } from '@personal-accountant/shared/constants/borangBMapping.js';

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
   * Get expenses grouped by Borang B section for a tax year
   */
  async getExpensesBySection(year) {
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const expenses = await Expense.findAll({
      where: {
        expense_date: { [Op.between]: [startDate, endDate] },
        is_tax_deductible: true,
      },
      include: [{ model: ExpenseCategory, as: 'category' }],
    });

    const sectionTotals = {};
    Object.keys(BORANG_B_SECTIONS).forEach(sec => { sectionTotals[sec] = 0; });

    expenses.forEach(exp => {
      const section = exp.category?.borang_b_section;
      if (!section || !sectionTotals.hasOwnProperty(section)) return;

      let amount = parseFloat(exp.amount_myr || exp.amount);

      // D15 (Entertainment) — 50% deductibility
      if (section === 'D15') amount = amount * 0.5;

      sectionTotals[section] += amount;
    });

    return { expenses, sectionTotals };
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
   * Generate full Borang B data for a year
   */
  async generateBorangBData(year) {
    const { totalIncome, invoices } = await this.getIncomeForYear(year);
    const { sectionTotals } = await this.getExpensesBySection(year);
    const { totalKm, deductibleAmount: mileageDeduction } = await this.getMileageDeduction(year);

    // Add mileage to D5 (motor vehicle)
    sectionTotals['D5'] = (sectionTotals['D5'] || 0) + mileageDeduction;

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
