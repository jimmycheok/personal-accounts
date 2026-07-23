import React, { useState, useEffect, useRef } from 'react';
import {
  TextInput, TextArea, Select, SelectItem, DatePicker, DatePickerInput,
  ComboBox, Button, InlineNotification, InlineLoading, Tag,
} from '@carbon/react';
import { Add, TrashCan, Upload } from '@carbon/icons-react';
import { format } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';

const METHODS = ['cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'];
const SALARY_CODE = '6100';

const EMPTY_LINE = () => ({ account_id: '', description: '', amount: '' });

export default function PaymentVoucherForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [accounts, setAccounts] = useState([]);
  const [form, setForm] = useState({
    pv_date: new Date().toISOString().slice(0, 10),
    payee_name: '', payee_bank_name: '', payee_bank_account: '', payee_tin: '',
    payment_method: 'bank_transfer', payment_reference: '', description: '', notes: '',
  });
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  // Load accounts; default new lines to the Salaries account (6100)
  useEffect(() => {
    api.get('/accounts').then(res => {
      const accts = res.data || [];
      setAccounts(accts);
      if (!isEdit) {
        const salary = accts.find(a => a.code === SALARY_CODE);
        if (salary) setLines([{ account_id: salary.id, description: '', amount: '' }]);
      }
    }).catch(console.error);
  }, []);

  // Load existing voucher in edit mode
  useEffect(() => {
    if (!isEdit) return;
    api.get(`/payment-vouchers/${id}`).then(res => {
      const v = res.data;
      if (v.status !== 'draft') { setError('Only draft vouchers can be edited.'); return; }
      setForm({
        pv_date: v.pv_date,
        payee_name: v.payee_name || '', payee_bank_name: v.payee_bank_name || '',
        payee_bank_account: v.payee_bank_account || '', payee_tin: v.payee_tin || '',
        payment_method: v.payment_method, payment_reference: v.payment_reference || '',
        description: v.description || '', notes: v.notes || '',
      });
      setLines((v.lines || []).map(l => ({ account_id: l.account_id, description: l.description || '', amount: String(l.amount) })));
    }).catch(err => setError(err.response?.data?.error || 'Failed to load voucher'));
  }, [id]);

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));
  const updateLine = (idx, key, val) => setLines(prev => prev.map((l, i) => i === idx ? { ...l, [key]: val } : l));
  const addLine = () => setLines(p => [...p, EMPTY_LINE()]);
  const removeLine = (idx) => setLines(p => p.filter((_, i) => i !== idx));

  const stageFiles = (e) => { setStagedFiles(p => [...p, ...Array.from(e.target.files || [])]); e.target.value = ''; };
  const removeStaged = (idx) => setStagedFiles(p => p.filter((_, i) => i !== idx));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const handleSubmit = async () => {
    if (!form.payee_name) { setError('Payee name is required'); return; }
    const clean = lines.filter(l => l.account_id && Number(l.amount) > 0);
    if (!clean.length) { setError('At least one line with an account and a positive amount is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { ...form, lines: clean.map(l => ({ account_id: l.account_id, description: l.description, amount: Number(l.amount) })) };
      let voucherId = id;
      if (isEdit) {
        await api.put(`/payment-vouchers/${id}`, payload);
      } else {
        const res = await api.post('/payment-vouchers', payload);
        voucherId = res.data.id;
      }
      // Upload staged attachments — non-blocking: the voucher is already saved,
      // so a failed upload must not trigger the "save failed" path (which would duplicate on retry).
      for (const file of stagedFiles) {
        try {
          const fd = new FormData();
          fd.append('file', file);
          fd.append('subject_type', 'payment_voucher');
          fd.append('subject_id', String(voucherId));
          await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
        } catch (uploadErr) {
          console.warn(`Attachment "${file.name}" failed to upload:`, uploadErr?.response?.data?.error || uploadErr.message);
        }
      }
      navigate(`/payment-vouchers/${voucherId}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment voucher');
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 400, marginBottom: '1.5rem' }}>
        {isEdit ? 'Edit Payment Voucher' : 'New Payment Voucher'}
      </h1>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
        <DatePicker datePickerType="single" value={new Date(form.pv_date)}
          onChange={([d]) => { if (d) setForm(p => ({ ...p, pv_date: format(d, 'yyyy-MM-dd') })); }}>
          <DatePickerInput id="pv-date" labelText="Voucher Date" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <Select id="pv-method" labelText="Payment Method" value={form.payment_method} onChange={set('payment_method')}>
          {METHODS.map(m => <SelectItem key={m} value={m} text={m.replace(/_/g, ' ')} />)}
        </Select>
        <TextInput id="pv-payee" labelText="Payee Name *" value={form.payee_name} onChange={set('payee_name')} />
        <TextInput id="pv-ref" labelText="Payment Reference" value={form.payment_reference} onChange={set('payment_reference')} placeholder="Cheque no. / transfer ref" />
        <TextInput id="pv-bank" labelText="Payee Bank" value={form.payee_bank_name} onChange={set('payee_bank_name')} />
        <TextInput id="pv-acct" labelText="Payee Bank Account" value={form.payee_bank_account} onChange={set('payee_bank_account')} />
        <TextInput id="pv-tin" labelText="Payee TIN" value={form.payee_tin} onChange={set('payee_tin')} />
      </div>

      <TextInput id="pv-desc" labelText="Description" value={form.description} onChange={set('description')} style={{ marginBottom: '1rem' }} />

      <TextArea id="pv-notes" labelText="Notes" value={form.notes} onChange={set('notes')} rows={2} style={{ marginBottom: '1rem' }} />

      {/* Line items */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '1rem 0 0.5rem' }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Line Items</h2>
        <Button kind="ghost" size="sm" renderIcon={Add} onClick={addLine}>Add Line</Button>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
        <thead>
          <tr style={{ background: '#f4f4f4', borderBottom: '2px solid #e0e0e0' }}>
            <th style={{ textAlign: 'left', padding: '0.5rem', width: '40%' }}>Account</th>
            <th style={{ textAlign: 'left', padding: '0.5rem', width: '35%' }}>Description</th>
            <th style={{ textAlign: 'right', padding: '0.5rem', width: '18%' }}>Amount (RM)</th>
            <th style={{ width: '7%' }}></th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <ComboBox id={`pv-line-acct-${idx}`} items={accounts}
                  itemToString={item => item ? `${item.code} — ${item.name}` : ''}
                  selectedItem={accounts.find(a => a.id === line.account_id) || null}
                  onChange={({ selectedItem }) => updateLine(idx, 'account_id', selectedItem?.id || '')}
                  placeholder="Select account" titleText="" hideLabel size="sm" />
              </td>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <TextInput id={`pv-line-desc-${idx}`} labelText="" hideLabel size="sm"
                  value={line.description} onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Particulars" />
              </td>
              <td style={{ padding: '0.25rem 0.5rem' }}>
                <TextInput id={`pv-line-amt-${idx}`} labelText="" hideLabel type="number" step="0.01" size="sm"
                  value={line.amount} onChange={e => updateLine(idx, 'amount', e.target.value)} placeholder="0.00" />
              </td>
              <td style={{ textAlign: 'center' }}>
                <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly
                  onClick={() => removeLine(idx)} disabled={lines.length <= 1} />
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '2px solid #161616' }}>
            <td colSpan={2} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>Total</td>
            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>RM {total.toFixed(2)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {/* Attachments */}
      <div style={{ marginTop: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Attachments {stagedFiles.length > 0 && `(${stagedFiles.length})`}</h2>
          <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }}
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp" onChange={stageFiles} />
          <Button kind="ghost" size="sm" renderIcon={Upload} onClick={() => fileInputRef.current?.click()}>Attach File</Button>
        </div>
        {stagedFiles.length === 0
          ? <p style={{ fontSize: '0.8125rem', color: '#6f6f6f', fontStyle: 'italic' }}>No attachments — files upload when the voucher is saved.</p>
          : stagedFiles.map((file, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f4f4f4', borderRadius: '4px', marginBottom: '0.375rem' }}>
              <Tag type="gray" size="sm">FILE</Tag>
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
              <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly onClick={() => removeStaged(idx)} />
            </div>
          ))}
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
        <Button kind="secondary" onClick={() => navigate('/payment-vouchers')} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <InlineLoading description="Saving..." /> : 'Save as Draft'}
        </Button>
      </div>
    </div>
  );
}
