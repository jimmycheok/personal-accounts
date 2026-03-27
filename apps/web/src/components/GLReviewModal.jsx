import React, { useState, useEffect, useMemo } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  ComboBox,
  TextInput,
  InlineLoading,
  InlineNotification,
  Tag,
} from '@carbon/react';
import { Bot, Checkmark, Add, TrashCan } from '@carbon/icons-react';
import api from '../services/api.js';

/**
 * Default line templates per transaction type.
 * Uses account codes to pre-select from the loaded CoA.
 */
const DEFAULT_TEMPLATES = {
  invoice_send:       [{ code: '1100', side: 'debit' }, { code: '4000', side: 'credit' }],
  invoice_void:       [{ code: '4000', side: 'debit' }, { code: '1100', side: 'credit' }],
  invoice_mark_paid:  [{ code: '1010', side: 'debit' }, { code: '1100', side: 'credit' }],
  payment_received:   [{ code: '1010', side: 'debit' }, { code: '1100', side: 'credit' }],
  expense_create:     [{ code: '6999', side: 'debit' }, { code: '1010', side: 'credit' }],
  credit_note_send:   [{ code: '4000', side: 'debit' }, { code: '1100', side: 'credit' }],
  credit_note_void:   [{ code: '1100', side: 'debit' }, { code: '4000', side: 'credit' }],
  mileage_create:     [{ code: '6400', side: 'debit' }, { code: '3000', side: 'credit' }],
};

/** Extract the total amount from transaction data regardless of type */
function getAmount(type, data) {
  if (!data) return 0;
  return parseFloat(data.total || data.amount || data.amount_myr || data.deductible_amount || 0);
}

/** Map expense borang_b_section to account code */
function expenseAccountCode(data) {
  const section = data?.borang_b_section;
  if (!section) return '6999';
  const map = { D1:'5000',D2:'6100',D3:'6200',D4:'6300',D5:'6400',D6:'6500',D7:'6600',D8:'6700',D9:'6800',D10:'6900',D11:'6910',D12:'6920',D13:'6930',D14:'6940',D15:'6950',D16:'6960',D17:'6970',D18:'6980',D19:'6990',D20:'6999' };
  return map[section] || '6999';
}

function buildDefaultLines(type, data, accounts) {
  const template = DEFAULT_TEMPLATES[type] || DEFAULT_TEMPLATES.invoice_send;
  const amount = getAmount(type, data);

  // For expenses, pick account by borang_b_section
  const resolvedTemplate = template.map(t => {
    if (type === 'expense_create' && t.side === 'debit') {
      return { ...t, code: expenseAccountCode(data) };
    }
    // For cash payments, use 1000 instead of 1010
    if (['payment_received', 'invoice_mark_paid'].includes(type) && t.code === '1010' && data?.method === 'cash') {
      return { ...t, code: '1000' };
    }
    return t;
  });

  return resolvedTemplate.map(t => {
    const acct = accounts.find(a => a.code === t.code);
    return {
      account_id: acct?.id || '',
      account_code: acct?.code || t.code,
      account_name: acct?.name || '',
      debit: t.side === 'debit' ? amount : 0,
      credit: t.side === 'credit' ? amount : 0,
      description: '',
    };
  });
}

/**
 * GLReviewModal — General Ledger entry review step.
 *
 * Opens immediately with smart defaults. User can edit freely.
 * "AI Suggest" button calls the AI only on demand for token efficiency.
 */
export default function GLReviewModal({ open, type, data, onAccept, onCancel }) {
  const [aiLoading, setAiLoading] = useState(false);
  const [error, setError] = useState('');
  const [explanation, setExplanation] = useState('');
  const [lines, setLines] = useState([]);
  const [accounts, setAccounts] = useState([]);

  // Fetch accounts once
  useEffect(() => {
    if (open && accounts.length === 0) {
      api.get('/accounts').then(res => setAccounts(res.data)).catch(console.error);
    }
  }, [open]);

  // Build default lines when modal opens (no AI call)
  useEffect(() => {
    if (!open || !type || !data) return;
    setError('');
    setExplanation('');
    // Wait for accounts to load before building defaults
    if (accounts.length > 0) {
      setLines(buildDefaultLines(type, data, accounts));
    }
  }, [open, type, accounts.length]);

  // AI suggest — only called on button click
  const handleAISuggest = async () => {
    setAiLoading(true);
    setError('');
    setExplanation('');
    try {
      const res = await api.post('/journal-entries/ai-suggest', { type, data });
      const result = res.data;
      if (result.success) {
        setLines(result.lines);
        setExplanation(result.explanation);
      } else {
        setError(result.message || 'AI could not suggest entries.');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to get AI suggestion.');
    } finally {
      setAiLoading(false);
    }
  };

  const updateLine = (idx, key, val) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      return updated;
    });
  };

  const setLineAccount = (idx, account) => {
    if (!account) return;
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], account_id: account.id, account_code: account.code, account_name: account.name };
      return updated;
    });
  };

  const addLine = () => setLines(p => [...p, { account_id: '', account_code: '', account_name: '', debit: 0, credit: 0, description: '' }]);
  const removeLine = (idx) => setLines(p => p.filter((_, i) => i !== idx));

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleAccept = () => {
    if (!isBalanced) return;
    onAccept(lines.map(l => ({
      account_id: l.account_id,
      debit: parseFloat(l.debit) || 0,
      credit: parseFloat(l.credit) || 0,
      description: l.description || '',
    })));
  };

  return (
    <ComposedModal open={open} onClose={onCancel} size="lg" preventCloseOnClickOutside>
      <ModalHeader>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 600 }}>General Ledger Entry</span>
        </div>
      </ModalHeader>
      <ModalBody>
        {error && <InlineNotification kind="warning" title={error} style={{ marginBottom: '1rem' }} lowContrast />}

        {explanation && (
          <div style={{ background: '#edf5ff', border: '1px solid #a6c8ff', borderRadius: '4px', padding: '0.75rem 1rem', marginBottom: '1rem', fontSize: '0.875rem', color: '#0043ce' }}>
            <strong>AI:</strong> {explanation}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>Journal Lines</span>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Button kind="ghost" size="sm" renderIcon={Bot} onClick={handleAISuggest} disabled={aiLoading}>
              {aiLoading ? 'Suggesting...' : 'AI Suggest'}
            </Button>
            <Button kind="ghost" size="sm" renderIcon={Add} onClick={addLine}>Add Line</Button>
          </div>
        </div>

        {aiLoading && (
          <div style={{ padding: '1rem', textAlign: 'center' }}>
            <InlineLoading description="AI is analysing..." />
          </div>
        )}

        <style>{`
          .gl-table .cds--text-input,
          .gl-table .cds--list-box,
          .gl-table .cds--list-box__field,
          .gl-table .cds--text-input--sm {
            background-color: transparent !important;
          }
        `}</style>
        <div style={{ overflowX: 'auto' }}>
          <table className="gl-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0', background: '#f4f4f4' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', width: '38%' }}>Account</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.5rem', width: '16%' }}>Debit (RM)</th>
                <th style={{ textAlign: 'right', padding: '0.5rem 0.5rem', width: '16%' }}>Credit (RM)</th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.5rem', width: '24%' }}>Note</th>
                <th style={{ width: '6%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', verticalAlign: 'middle' }}>
                  <td style={{ padding: '0.25rem 0.5rem' }}>
                    <ComboBox
                      id={`gl-acct-${idx}`}
                      items={accounts}
                      itemToString={item => item ? `${item.code} — ${item.name}` : ''}
                      selectedItem={accounts.find(a => a.id === line.account_id) || null}
                      onChange={({ selectedItem }) => setLineAccount(idx, selectedItem)}
                      placeholder="Select account"
                      titleText=""
                      hideLabel
                      size="sm"
                    />
                  </td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>
                    <TextInput id={`gl-dr-${idx}`} labelText="" hideLabel type="number" step="0.01" size="sm"
                      value={line.debit} onChange={e => updateLine(idx, 'debit', e.target.value)} placeholder="0.00" />
                  </td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>
                    <TextInput id={`gl-cr-${idx}`} labelText="" hideLabel type="number" step="0.01" size="sm"
                      value={line.credit} onChange={e => updateLine(idx, 'credit', e.target.value)} placeholder="0.00" />
                  </td>
                  <td style={{ padding: '0.25rem 0.5rem' }}>
                    <TextInput id={`gl-desc-${idx}`} labelText="" hideLabel size="sm"
                      value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Optional" />
                  </td>
                  <td style={{ padding: '0.25rem 0', textAlign: 'center', verticalAlign: 'middle' }}>
                    <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly
                      onClick={() => removeLine(idx)} disabled={lines.length <= 2} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e0e0e0' }}>
                <td style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'right' }}>Totals</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: isBalanced ? '#0e6027' : '#da1e28' }}>
                  {totalDebit.toFixed(2)}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: isBalanced ? '#0e6027' : '#da1e28' }}>
                  {totalCredit.toFixed(2)}
                </td>
                <td colSpan={2} style={{ padding: '0.5rem', color: isBalanced ? '#0e6027' : '#da1e28', fontWeight: 600 }}>
                  {isBalanced ? 'Balanced' : 'Not balanced'}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </ModalBody>
      <ModalFooter>
        <Button kind="secondary" onClick={onCancel}>Cancel</Button>
        <Button kind="ghost" onClick={() => onAccept([])}>
          Skip GL Entry
        </Button>
        <Button
          renderIcon={Checkmark}
          onClick={handleAccept}
          disabled={aiLoading || !isBalanced || lines.some(l => !l.account_id)}
        >
          Accept & Proceed
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
