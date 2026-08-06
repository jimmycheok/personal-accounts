import { sequelize } from '../models/index.js';
import {
  CASH_ACCOUNT_CODES,
  buildMonthBuckets,
  applyCashRows,
  finaliseMonths,
  applySectionRules,
} from './ledgerAggregation.js';

/** All money questions answered from the general ledger, so every module that
 *  posts an entry (invoices, expenses, payment vouchers) is counted the same. */
class LedgerQueryService {
  async #cashRows(from, to) {
    const [rows] = await sequelize.query(
      `SELECT to_char(je.entry_date, 'YYYY-MM') AS month,
              COALESCE(SUM(jel.debit), 0)  AS inflow,
              COALESCE(SUM(jel.credit), 0) AS outflow
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       JOIN accounts a        ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND je.entry_date BETWEEN :from AND :to
         AND a.code IN (:cashCodes)
         AND je.source_type != 'year_end_close'
       GROUP BY 1`,
      { replacements: { from, to, cashCodes: CASH_ACCOUNT_CODES } },
    );
    return rows;
  }

  async getCashFlowByMonth(from, to) {
    const buckets = buildMonthBuckets(from, to);
    applyCashRows(buckets, await this.#cashRows(from, to));
    return finaliseMonths(buckets);
  }

  async getCashTotals(from, to) {
    const months = await this.getCashFlowByMonth(from, to);
    return {
      income: months.reduce((s, m) => s + m.income, 0),
      expenses: months.reduce((s, m) => s + m.expenses, 0),
    };
  }

  /** Deductible expense totals keyed by Borang B section. Accounts with a NULL
   *  borang_b_section (e.g. 6995 Non-Deductible) are excluded by the WHERE. */
  async getExpensesBySection(from, to) {
    const [rows] = await sequelize.query(
      `SELECT a.borang_b_section AS section,
              COALESCE(SUM(jel.debit), 0) - COALESCE(SUM(jel.credit), 0) AS amount
       FROM journal_entry_lines jel
       JOIN journal_entries je ON je.id = jel.journal_entry_id
       JOIN accounts a        ON a.id = jel.account_id
       WHERE je.status = 'posted'
         AND a.account_type = 'expense'
         AND a.borang_b_section IS NOT NULL
         AND je.entry_date BETWEEN :from AND :to
         AND je.source_type != 'year_end_close'
       GROUP BY 1`,
      { replacements: { from, to } },
    );
    return applySectionRules(rows);
  }
}

export default new LedgerQueryService();
