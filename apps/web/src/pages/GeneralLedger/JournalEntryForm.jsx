import React, { useState, useEffect } from 'react';
import {
  Tile,
  TextInput,
  TextArea,
  DatePicker,
  DatePickerInput,
  Button,
  ComboBox,
  Select,
  SelectItem,
  InlineNotification,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../../services/api.js';

const DEFAULT_LINE = { account_id: '', debit: '', credit: '', description: '' };

const SOURCE_TYPES = [
  { value: '', label: 'None' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'credit_note', label: 'Credit Note' },
  { value: 'payment', label: 'Payment' },
  { value: 'expense', label: 'Expense' },
];

export default function JournalEntryFormPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [description, setDescription] = useState('');
  const [sourceType, setSourceType] = useState('');
  const [sourceId, setSourceId] = useState('');
  const [referenceOptions, setReferenceOptions] = useState([]);
  const [lines, setLines] = useState([{ ...DEFAULT_LINE }, { ...DEFAULT_LINE }]);

  useEffect(() => {
    api.get('/accounts').then(res => setAccounts(res.data)).catch(console.error);
  }, []);

  useEffect(() => {
    if (!sourceType) { setReferenceOptions([]); setSourceId(''); return; }
    const endpoints = {
      invoice: '/invoices',
      credit_note: '/credit-notes',
      payment: '/invoices',
      expense: '/expenses',
    };
    api.get(endpoints[sourceType]).then(res => {
      const data = res.data;
      let options = [];
      if (sourceType === 'invoice') {
        const list = data.invoices || data;
        options = list.map(i => ({ id: i.id, label: `${i.invoice_number} — ${i.customer?.name || ''} (RM ${Number(i.total || 0).toFixed(2)})` }));
      } else if (sourceType === 'credit_note') {
        const list = data.creditNotes || data;
        options = list.map(c => ({ id: c.id, label: `${c.credit_note_number} — RM ${Number(c.amount || 0).toFixed(2)}` }));
      } else if (sourceType === 'payment') {
        // Payments are nested under invoices — flatten
        const list = data.invoices || data;
        const payments = [];
        list.forEach(inv => {
          (inv.payments || []).forEach(p => {
            payments.push({ id: p.id, label: `Payment #${p.id} — ${inv.invoice_number} (RM ${Number(p.amount || 0).toFixed(2)})` });
          });
        });
        options = payments;
      } else if (sourceType === 'expense') {
        const list = data.expenses || data;
        options = list.map(e => ({ id: e.id, label: `${e.vendor_name || 'Expense'} — ${e.expense_date} (RM ${Number(e.amount_myr || e.amount || 0).toFixed(2)})` }));
      }
      setReferenceOptions(options);
    }).catch(() => setReferenceOptions([]));
    setSourceId('');
  }, [sourceType]);

  const updateLine = (idx, key, val) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      return updated;
    });
  };

  const addLine = () => setLines(p => [...p, { ...DEFAULT_LINE }]);
  const removeLine = (idx) => setLines(p => p.filter((_, i) => i !== idx));

  const totalDebit = lines.reduce((s, l) => s + (parseFloat(l.debit) || 0), 0);
  const totalCredit = lines.reduce((s, l) => s + (parseFloat(l.credit) || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSave = async () => {
    if (!entryDate) { setError('Entry date is required'); return; }
    if (!isBalanced) { setError('Debits must equal credits'); return; }
    if (lines.some(l => !l.account_id)) { setError('All lines must have an account'); return; }

    setSaving(true);
    setError('');
    try {
      await api.post('/journal-entries', {
        entry_date: entryDate,
        description,
        source_type: sourceType || undefined,
        source_id: sourceId || undefined,
        lines: lines.map(l => ({
          account_id: l.account_id,
          debit: parseFloat(l.debit) || 0,
          credit: parseFloat(l.credit) || 0,
          description: l.description,
        })),
      });
      navigate('/general-ledger');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create journal entry');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>New Journal Entry</h1>
        <Button kind="ghost" onClick={() => navigate('/general-ledger')}>Cancel</Button>
      </div>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 className="form-section-title">Entry Details</h3>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <DatePicker datePickerType="single" value={new Date(entryDate)} onChange={([d]) => d && setEntryDate(format(d, 'yyyy-MM-dd'))}>
            <DatePickerInput id="entry_date" labelText="Entry Date *" placeholder="YYYY-MM-DD" />
          </DatePicker>
          <TextInput id="description" labelText="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe this journal entry" />
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <Select id="source_type" labelText="Reference Type" value={sourceType}
            onChange={e => setSourceType(e.target.value)}>
            {SOURCE_TYPES.map(t => <SelectItem key={t.value} value={t.value} text={t.label} />)}
          </Select>
          {sourceType && (
            <ComboBox
              id="source_id"
              titleText="Reference"
              placeholder="Search and select..."
              items={referenceOptions}
              itemToString={item => item ? item.label : ''}
              selectedItem={referenceOptions.find(o => o.id === sourceId) || null}
              onChange={({ selectedItem }) => setSourceId(selectedItem?.id || '')}
            />
          )}
        </div>
      </Tile>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="form-section-title" style={{ margin: 0 }}>Lines</h3>
          <Button renderIcon={Add} size="sm" onClick={addLine}>Add Line</Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', width: '35%' }}>Account</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '15%' }}>Debit</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '15%' }}>Credit</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', width: '25%' }}>Description</th>
                <th style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <ComboBox
                      id={`acct-${idx}`}
                      items={accounts}
                      itemToString={item => item ? `${item.code} — ${item.name}` : ''}
                      selectedItem={accounts.find(a => a.id === line.account_id) || null}
                      onChange={({ selectedItem }) => updateLine(idx, 'account_id', selectedItem?.id || '')}
                      placeholder="Select account"
                      titleText=""
                      hideLabel
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput id={`debit-${idx}`} labelText="" hideLabel type="number" step="0.01" value={line.debit}
                      onChange={e => updateLine(idx, 'debit', e.target.value)} placeholder="0.00" />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput id={`credit-${idx}`} labelText="" hideLabel type="number" step="0.01" value={line.credit}
                      onChange={e => updateLine(idx, 'credit', e.target.value)} placeholder="0.00" />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput id={`desc-${idx}`} labelText="" hideLabel value={line.description}
                      onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Optional" />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
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
                  RM {totalDebit.toFixed(2)}
                </td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: isBalanced ? '#0e6027' : '#da1e28' }}>
                  RM {totalCredit.toFixed(2)}
                </td>
                <td colSpan={2} style={{ padding: '0.5rem', color: isBalanced ? '#0e6027' : '#da1e28', fontWeight: 600 }}>
                  {isBalanced ? 'Balanced' : `Difference: RM ${Math.abs(totalDebit - totalCredit).toFixed(2)}`}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Tile>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <Button kind="secondary" onClick={() => navigate('/general-ledger')}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !isBalanced}>
          {saving ? 'Saving...' : 'Save as Draft'}
        </Button>
      </div>
    </div>
  );
}
