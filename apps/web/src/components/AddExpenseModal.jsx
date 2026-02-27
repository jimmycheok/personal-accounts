import React, { useState, useEffect, useRef } from 'react';
import {
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  InlineNotification,
  Tag,
  InlineLoading,
} from '@carbon/react';
import { Upload, TrashCan } from '@carbon/icons-react';
import api from '../services/api.js';

const EMPTY_FORM = () => ({
  vendor_name: '',
  description: '',
  amount: '',
  expense_date: new Date().toISOString().slice(0, 10),
  category_id: '',
  notes: '',
  currency: 'MYR',
});

const MIME_LABEL = {
  'application/pdf': { label: 'PDF', type: 'red' },
  'image/jpeg': { label: 'JPG', type: 'purple' },
  'image/png': { label: 'PNG', type: 'purple' },
  'image/gif': { label: 'GIF', type: 'purple' },
  'image/webp': { label: 'WEBP', type: 'purple' },
  'text/csv': { label: 'CSV', type: 'teal' },
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AddExpenseModal({ open, onClose, prefill, onSuccess }) {
  const [form, setForm] = useState(EMPTY_FORM());
  const [categories, setCategories] = useState([]);
  const [stagedFiles, setStagedFiles] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    api.get('/expense-categories').then(res => setCategories(res.data || [])).catch(console.error);
  }, []);

  // Apply OCR prefill
  useEffect(() => {
    if (prefill) {
      setForm(p => ({
        ...p,
        vendor_name: prefill.vendor || p.vendor_name,
        description: prefill.description || p.description,
        amount: prefill.amount ? String(prefill.amount) : p.amount,
        expense_date: prefill.date || p.expense_date,
      }));
    }
  }, [prefill]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setForm(EMPTY_FORM());
      setStagedFiles([]);
      setError('');
    }
  }, [open]);

  const handleStageFiles = (e) => {
    const files = Array.from(e.target.files || []);
    setStagedFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removeStaged = (idx) => setStagedFiles(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!form.vendor_name) { setError('Vendor / Supplier is required'); return; }
    if (!form.amount || Number(form.amount) <= 0) { setError('A valid amount is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/expenses', {
        ...form,
        amount: Number(form.amount),
        category_id: form.category_id || null,
      });
      const expenseId = res.data.id;

      // Upload any staged attachments
      for (const file of stagedFiles) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('subject_type', 'expense');
        fd.append('subject_id', String(expenseId));
        await api.post('/documents', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      }

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  const set = (field) => (e) => setForm(p => ({ ...p, [field]: e.target.value }));

  return (
    <ComposedModal open={open} onClose={onClose} size="md">
      <ModalHeader title="Add Expense" />

      <ModalBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <InlineNotification kind="error" title={error} />}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <TextInput
              id="ae-vendor"
              labelText="Vendor / Supplier *"
              value={form.vendor_name}
              onChange={set('vendor_name')}
              placeholder="e.g. Watsons, TNB"
            />
            <TextInput
              id="ae-amount"
              labelText="Amount (RM) *"
              type="number"
              step="0.01"
              value={form.amount}
              onChange={set('amount')}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <DatePicker
              datePickerType="single"
              value={form.expense_date}
              onChange={([d]) => { if (d) setForm(p => ({ ...p, expense_date: d.toISOString().slice(0, 10) })); }}
            >
              <DatePickerInput id="ae-date" labelText="Date" placeholder="YYYY-MM-DD" />
            </DatePicker>
            <Select id="ae-category" labelText="Category" value={form.category_id} onChange={set('category_id')}>
              <SelectItem value="" text="Select category..." />
              {categories.map(cat => (
                <SelectItem
                  key={cat.id}
                  value={String(cat.id)}
                  text={cat.borang_b_section ? `${cat.borang_b_section} — ${cat.name}` : cat.name}
                />
              ))}
            </Select>
          </div>

          <TextInput
            id="ae-desc"
            labelText="Description"
            value={form.description}
            onChange={set('description')}
            placeholder="What was this expense for?"
          />

          <TextArea
            id="ae-notes"
            labelText="Notes"
            value={form.notes}
            onChange={set('notes')}
            rows={2}
          />

          {/* Attachments */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, margin: 0 }}>
                Attachments {stagedFiles.length > 0 && `(${stagedFiles.length})`}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                style={{ display: 'none' }}
                accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.csv,.xlsx,.xls"
                onChange={handleStageFiles}
              />
              <Button
                kind="ghost"
                size="sm"
                renderIcon={Upload}
                onClick={() => fileInputRef.current?.click()}
              >
                Attach File
              </Button>
            </div>

            {stagedFiles.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: '#6f6f6f', fontStyle: 'italic' }}>No attachments — receipts will be uploaded with the expense.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
                {stagedFiles.map((file, idx) => {
                  const mimeTag = MIME_LABEL[file.type] || { label: 'FILE', type: 'gray' };
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', background: '#f4f4f4', borderRadius: '4px' }}>
                      <Tag type={mimeTag.type} size="sm">{mimeTag.label}</Tag>
                      <span style={{ flex: 1, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                      <span style={{ fontSize: '0.75rem', color: '#6f6f6f', flexShrink: 0 }}>{formatBytes(file.size)}</span>
                      <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly onClick={() => removeStaged(idx)} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter>
        <Button kind="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={saving}>
          {saving ? <InlineLoading description="Saving..." /> : 'Add Expense'}
        </Button>
      </ModalFooter>
    </ComposedModal>
  );
}
