import { sequelize, Account } from '../models/index.js';

class ReportService {

  // ── Profit & Loss ────────────────────────────────────────────────────
  async getProfitLoss(from, to) {
    const rows = await sequelize.query(`
      SELECT a.id, a.code, a.name, a.account_type, a.sub_type, a.borang_b_section,
             COALESCE(SUM(jel.debit), 0)  AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit
      FROM accounts a
      JOIN journal_entry_lines jel ON jel.account_id = a.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date BETWEEN :from AND :to
        AND a.account_type IN ('revenue', 'expense')
        AND je.source_type != 'year_end_close'
      GROUP BY a.id
      ORDER BY a.code
    `, { replacements: { from, to }, type: sequelize.constructor.QueryTypes.SELECT });

    const revenue = [];
    const cogs = [];
    const operatingExpenses = [];
    let totalRevenue = 0, totalCogs = 0, totalOpex = 0;

    for (const row of rows) {
      const amount = row.account_type === 'revenue'
        ? parseFloat(row.total_credit) - parseFloat(row.total_debit)
        : parseFloat(row.total_debit) - parseFloat(row.total_credit);

      if (Math.abs(amount) < 0.01) continue;

      const entry = { id: row.id, code: row.code, name: row.name, borang_b_section: row.borang_b_section, amount };

      if (row.account_type === 'revenue') {
        revenue.push(entry);
        totalRevenue += amount;
      } else if (row.sub_type === 'cogs') {
        cogs.push(entry);
        totalCogs += amount;
      } else {
        operatingExpenses.push(entry);
        totalOpex += amount;
      }
    }

    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalOpex;

    return {
      period: { from, to },
      revenue,
      totalRevenue,
      cogs,
      totalCogs,
      grossProfit,
      operatingExpenses,
      totalOperatingExpenses: totalOpex,
      netProfit,
    };
  }

  // ── Balance Sheet ────────────────────────────────────────────────────
  async getBalanceSheet(asAt) {
    // Get all account balances as of date
    const rows = await sequelize.query(`
      SELECT a.id, a.code, a.name, a.account_type, a.sub_type,
             COALESCE(SUM(jel.debit), 0)  AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted'
        AND je.entry_date <= :asAt
      GROUP BY a.id
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.code
    `, { replacements: { asAt }, type: sequelize.constructor.QueryTypes.SELECT });

    const currentAssets = [];
    const fixedAssets = [];
    const currentLiabilities = [];
    const longTermLiabilities = [];
    const equity = [];
    let totalCurrentAssets = 0, totalFixedAssets = 0;
    let totalCurrentLiabilities = 0, totalLongTermLiabilities = 0;
    let totalEquity = 0;

    for (const row of rows) {
      const debit = parseFloat(row.total_debit);
      const credit = parseFloat(row.total_credit);

      // Natural balance: assets/expenses = debit, liabilities/equity/revenue = credit
      let balance;
      if (row.account_type === 'asset' || row.account_type === 'expense') {
        balance = debit - credit;
      } else {
        balance = credit - debit;
      }

      if (Math.abs(balance) < 0.01) continue;

      const entry = { id: row.id, code: row.code, name: row.name, balance };

      switch (row.sub_type) {
        case 'current_asset':
          currentAssets.push(entry);
          totalCurrentAssets += balance;
          break;
        case 'fixed_asset':
          fixedAssets.push(entry);
          totalFixedAssets += balance;
          break;
        case 'current_liability':
          currentLiabilities.push(entry);
          totalCurrentLiabilities += balance;
          break;
        case 'long_term_liability':
          longTermLiabilities.push(entry);
          totalLongTermLiabilities += balance;
          break;
        case 'equity':
          equity.push(entry);
          totalEquity += balance;
          break;
        default:
          break;
      }
    }

    // Calculate retained earnings from unclose revenue/expense
    // (revenue - expenses that haven't been closed via year-end)
    const unclosedPL = await sequelize.query(`
      SELECT
        COALESCE(SUM(CASE WHEN a.account_type = 'revenue' THEN jel.credit - jel.debit ELSE 0 END), 0) AS revenue,
        COALESCE(SUM(CASE WHEN a.account_type = 'expense' THEN jel.debit - jel.credit ELSE 0 END), 0) AS expenses
      FROM accounts a
      JOIN journal_entry_lines jel ON jel.account_id = a.id
      JOIN journal_entries je ON je.id = jel.journal_entry_id
      WHERE je.status = 'posted'
        AND je.entry_date <= :asAt
        AND je.source_type != 'year_end_close'
        AND a.account_type IN ('revenue', 'expense')
    `, { replacements: { asAt }, type: sequelize.constructor.QueryTypes.SELECT });

    const currentYearPL = parseFloat(unclosedPL[0]?.revenue || 0) - parseFloat(unclosedPL[0]?.expenses || 0);

    const totalAssets = totalCurrentAssets + totalFixedAssets;
    const totalLiabilities = totalCurrentLiabilities + totalLongTermLiabilities;

    return {
      asAt,
      currentAssets,
      totalCurrentAssets,
      fixedAssets,
      totalFixedAssets,
      totalAssets,
      currentLiabilities,
      totalCurrentLiabilities,
      longTermLiabilities,
      totalLongTermLiabilities,
      totalLiabilities,
      equity,
      currentYearEarnings: currentYearPL,
      totalEquity: totalEquity + currentYearPL,
      totalLiabilitiesAndEquity: totalLiabilities + totalEquity + currentYearPL,
    };
  }

  // ── Trial Balance ────────────────────────────────────────────────────
  async getTrialBalance(asAt) {
    const rows = await sequelize.query(`
      SELECT a.id, a.code, a.name, a.account_type, a.sub_type,
             COALESCE(SUM(jel.debit), 0)  AS total_debit,
             COALESCE(SUM(jel.credit), 0) AS total_credit
      FROM accounts a
      LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
      LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        AND je.status = 'posted'
        AND je.entry_date <= :asAt
      GROUP BY a.id
      HAVING COALESCE(SUM(jel.debit), 0) != 0 OR COALESCE(SUM(jel.credit), 0) != 0
      ORDER BY a.code
    `, { replacements: { asAt }, type: sequelize.constructor.QueryTypes.SELECT });

    let totalDebit = 0, totalCredit = 0;
    const accounts = rows.map(row => {
      const debit = parseFloat(row.total_debit);
      const credit = parseFloat(row.total_credit);

      // Show balance in natural column
      let debitBalance = 0, creditBalance = 0;
      if (['asset', 'expense'].includes(row.account_type)) {
        const net = debit - credit;
        if (net >= 0) debitBalance = net; else creditBalance = Math.abs(net);
      } else {
        const net = credit - debit;
        if (net >= 0) creditBalance = net; else debitBalance = Math.abs(net);
      }

      totalDebit += debitBalance;
      totalCredit += creditBalance;

      return {
        id: row.id, code: row.code, name: row.name,
        account_type: row.account_type, sub_type: row.sub_type,
        debit: debitBalance, credit: creditBalance,
      };
    });

    return {
      asAt,
      accounts,
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    };
  }
}

export default new ReportService();
