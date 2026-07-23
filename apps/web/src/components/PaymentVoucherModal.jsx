import React, { useState, useEffect, useRef } from 'react';
import {
  ComposedModal, ModalHeader, ModalBody, ModalFooter,
  TextInput, TextArea, Select, SelectItem, DatePicker, DatePickerInput,
  Button, InlineNotification, InlineLoading, Tag,
} from '@carbon/react';
import { Add, TrashCan, Upload } from '@carbon/icons-react';
import { format } from 'date-fns';
import api from '../services/api.js';
import GLReviewModal from './GLReviewModal.jsx';

const METHODS = ['cash', 'bank_transfer', 'duitnow', 'cheque', 'credit_card', 'online_banking', 'other'];
const titleCase = (s) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const EMPTY_LINE = () => ({ service_item: '', amount: '' });
const EMPTY_FORM = () => ({
  pv_date: new Date().toISOString().slice(0, 10),
  payee_name: '', payee_bank_name: '', payee_bank_account: '', payee_tin: '',
  payment_method: 'bank_transfer', payment_reference: '', description: '', notes: '',
});

export default function PaymentVoucherModal({ open, onClose, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM());
  const [lines, setLines] = useState([EMPTY_LINE()]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGL, setShowGL] = useState(false);
  const fileInputRef = useRef(null);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM());
      setLines([EMPTY_LINE()]);
      setStagedFiles([]);
      setError('');
      setShowGL(false);
      setSaving(false);
    }
  }, [open]);

  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }));
  const updateLine = (idx, key, val) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [key]: val } : l)));
  const addLine = () => setLines((p) => [...p, EMPTY_LINE()]);
  const removeLine = (idx) => setLines((p) => p.filter((_, i) => i !== idx));

  const stageFiles = (e) => { setStagedFiles((p) => [...p, ...Array.from(e.target.files || [])]); e.target.value = ''; };
  const removeStaged = (idx) => setStagedFiles((p) => p.filter((_, i) => i !== idx));

  const total = lines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0);

  const handleSubmit = () => {
    if (!form.payee_name) { setError('Payee name is required'); return; }
    const clean = lines.filter((l) => l.service_item && Number(l.amount) > 0);
    if (!clean.length) { setError('At least one service item with a positive amount is required'); return; }
    setError('');
    setShowGL(true);
  };

  const handleGLAccept = async (journalLines) => {
    setShowGL(false);
    if (!journalLines?.length) { setError('A balanced GL entry is required to save this voucher.'); return; }
    setSaving(true);
    setError('');
    try {
      const clean = lines.filter((l) => l.service_item && Number(l.amount) > 0);
      const res = await api.post('/payment-vouchers', {
        ...form,
        lines: clean.map((l) => ({ service_item: l.service_item, amount: Number(l.amount) })),
        journal_lines: journalLines,
      });
      const voucherId = res.data.id;
      // Upload staged attachments — non-blocking: the voucher is already saved.
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
      onSuccess?.(res.data);
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save payment voucher');
      setSaving(false);
    }
  };

  return (
    <>
      <ComposedModal open={open && !showGL} onClose={onClose} size="lg" preventCloseOnClickOutside>
        <ModalHeader title="New Payment Voucher" />
        <ModalBody hasScrollingContent>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} />}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <DatePicker datePickerType="single" value={new Date(form.pv_date)}
                onChange={([d]) => { if (d) setForm((p) => ({ ...p, pv_date: format(d, 'yyyy-MM-dd') })); }}>
                <DatePickerInput id="pv-date" labelText="Voucher Date" placeholder="YYYY-MM-DD" />
              </DatePicker>
              <Select id="pv-method" labelText="Payment Method" value={form.payment_method} onChange={set('payment_method')}>
                {METHODS.map((m) => <SelectItem key={m} value={m} text={titleCase(m)} />)}
              </Select>
              <TextInput id="pv-payee" labelText="Payee Name *" value={form.payee_name} onChange={set('payee_name')} />
              <TextInput id="pv-ref" labelText="Payment Reference" value={form.payment_reference} onChange={set('payment_reference')} placeholder="Cheque no. / transfer ref" />
              <TextInput id="pv-bank" labelText="Payee Bank" value={form.payee_bank_name} onChange={set('payee_bank_name')} />
              <TextInput id="pv-acct" labelText="Payee Bank Account" value={form.payee_bank_account} onChange={set('payee_bank_account')} />
              <TextInput id="pv-tin" labelText="Payee TIN" value={form.payee_tin} onChange={set('payee_tin')} />
            </div>

            <TextInput id="pv-desc" labelText="Description" value={form.description} onChange={set('description')} />
            <TextArea id="pv-notes" labelText="Notes" value={form.notes} onChange={set('notes')} rows={2} />

            {/* Service items */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>Service Items</p>
              <Button kind="ghost" size="sm" renderIcon={Add} onClick={addLine}>Add Item</Button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f4f4f4', borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem', width: '70%' }}>Service Item</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem', width: '23%' }}>Amount (RM)</th>
                  <th style={{ width: '7%' }}></th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                    <td style={{ padding: '0.25rem 0.5rem' }}>
                      <TextInput id={`pv-item-${idx}`} labelText="" hideLabel size="sm"
                        value={line.service_item} onChange={(e) => updateLine(idx, 'service_item', e.target.value)}
                        placeholder="e.g. Logo design" />
                    </td>
                    <td style={{ padding: '0.25rem 0.5rem' }}>
                      <TextInput id={`pv-amt-${idx}`} labelText="" hideLabel type="number" step="0.01" size="sm"
                        value={line.amount} onChange={(e) => updateLine(idx, 'amount', e.target.value)} placeholder="0.00" />
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
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>Total</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>RM {total.toFixed(2)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>

            {/* Attachments */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                  Attachments {stagedFiles.length > 0 && `(${stagedFiles.length})`}
                </p>
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
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <InlineLoading description="Saving..." /> : 'Save Voucher'}
          </Button>
        </ModalFooter>
      </ComposedModal>

      <GLReviewModal
        open={showGL}
        type="payment_voucher_create"
        data={{ amount: total, payee_name: form.payee_name, method: form.payment_method }}
        onAccept={handleGLAccept}
        onCancel={() => setShowGL(false)}
      />
    </>
  );
}
