import Anthropic from '@anthropic-ai/sdk';
import { Account } from '../models/index.js';

let anthropic;
function getClient() {
  if (!anthropic) anthropic = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  return anthropic;
}

// Single tool — returns the journal entry suggestion
const tools = [
  {
    name: 'suggest_journal_entry',
    description: 'Return balanced journal entry lines. Total debits MUST equal total credits.',
    input_schema: {
      type: 'object',
      properties: {
        description: { type: 'string' },
        lines: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              account_id: { type: 'integer' },
              account_code: { type: 'string' },
              account_name: { type: 'string' },
              debit: { type: 'number' },
              credit: { type: 'number' },
              line_description: { type: 'string' },
            },
            required: ['account_id', 'account_code', 'account_name', 'debit', 'credit'],
          },
        },
        explanation: { type: 'string', description: 'One-sentence explanation for a non-accountant.' },
      },
      required: ['description', 'lines', 'explanation'],
    },
  },
];

const SYSTEM_PROMPT = `You are a Malaysian sole proprietor accounting assistant. Given a transaction and the chart of accounts, call suggest_journal_entry with correct balanced double-entry lines.

Rules: Assets/Expenses increase with DEBIT. Liabilities/Equity/Revenue increase with CREDIT. Debits must equal credits.`;

// Cache accounts for 5 minutes
let accountsCache = null;
let accountsCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000;

async function getAccounts() {
  if (accountsCache && Date.now() - accountsCacheTime < CACHE_TTL) return accountsCache;
  const rows = await Account.findAll({ where: { is_active: true }, order: [['code', 'ASC']], raw: true });
  accountsCache = rows.map(a => ({ id: a.id, code: a.code, name: a.name, type: a.account_type, bb: a.borang_b_section }));
  accountsCacheTime = Date.now();
  return accountsCache;
}

function buildPrompt(type, data, accounts) {
  // Compact account list: "id|code|name|type|bb"
  const acctList = accounts.map(a => `${a.id}|${a.code}|${a.name}|${a.type}${a.bb ? '|' + a.bb : ''}`).join('\n');

  const amt = (v) => `RM ${Number(v || 0).toFixed(2)}`;
  let txn;

  switch (type) {
    case 'invoice_send':
      txn = `Invoice ${data.invoice_number || ''} sent. Total: ${amt(data.total)}.`;
      break;
    case 'invoice_void':
      txn = `Void invoice ${data.invoice_number || ''}. Total: ${amt(data.total)}. Reverse the original entry.`;
      break;
    case 'invoice_mark_paid':
      txn = `Invoice ${data.invoice_number || ''} marked fully paid. Total: ${amt(data.total)}.`;
      break;
    case 'payment_received':
      txn = `Payment ${amt(data.amount)} received for invoice ${data.invoice_number || ''}. Method: ${data.method || 'bank_transfer'}. Use 1000 for cash, 1010 otherwise.`;
      break;
    case 'expense_create':
      txn = `Expense ${amt(data.amount_myr || data.amount)} to ${data.vendor_name || 'vendor'}. Category: ${data.category_name || 'N/A'}, Borang B: ${data.borang_b_section || 'N/A'}. Match expense account by Borang B section.`;
      break;
    case 'credit_note_send':
      txn = `Credit note ${data.credit_note_number || ''} issued. Amount: ${amt(data.amount)}. Reverse revenue.`;
      break;
    case 'credit_note_void':
      txn = `Void credit note ${data.credit_note_number || ''}. Amount: ${amt(data.amount)}. Reverse the credit note entry.`;
      break;
    case 'mileage_create':
      txn = `Mileage trip: ${data.from_location || ''} → ${data.to_location || ''}, ${data.km || 0} km. Deductible: ${amt(data.deductible_amount)}. DR Motor Vehicle Expenses (D5), CR Bank/Owner's Capital.`;
      break;
    default:
      txn = JSON.stringify(data);
  }

  return `Transaction: ${txn}\n\nChart of Accounts (id|code|name|type|borangB):\n${acctList}`;
}

class AccountingAIService {
  async suggest(type, data) {
    const accounts = await getAccounts();
    const userPrompt = buildPrompt(type, data, accounts);

    const response = await getClient().messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      tools,
      tool_choice: { type: 'tool', name: 'suggest_journal_entry' },
    });

    // Extract the tool use block
    const toolBlock = response.content.find(b => b.type === 'tool_use');
    if (!toolBlock) {
      const text = response.content.filter(b => b.type === 'text').map(b => b.text).join(' ');
      return { success: false, message: text || 'AI could not suggest entries.' };
    }

    const args = toolBlock.input;
    const totalDebit = args.lines.reduce((s, l) => s + (l.debit || 0), 0);
    const totalCredit = args.lines.reduce((s, l) => s + (l.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return { success: false, message: `Unbalanced (DR: RM ${totalDebit.toFixed(2)}, CR: RM ${totalCredit.toFixed(2)}).` };
    }

    return {
      success: true,
      description: args.description,
      lines: args.lines.map(l => ({
        account_id: l.account_id,
        account_code: l.account_code,
        account_name: l.account_name,
        debit: l.debit || 0,
        credit: l.credit || 0,
        description: l.line_description || '',
      })),
      explanation: args.explanation,
    };
  }
}

export default new AccountingAIService();
