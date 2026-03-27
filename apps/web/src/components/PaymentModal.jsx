import React, { useState } from 'react';
import {
  Modal,
  TextInput,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  InlineNotification,
} from '@carbon/react';
import { format } from 'date-fns';
import api from '../services/api.js';
import GLReviewModal from './GLReviewModal.jsx';

export default function PaymentModal({ open, onClose, invoiceId, invoiceNumber, amountDue, onSuccess }) {
  const [form, setForm] = useState({
    amount: amountDue,
    payment_date: new Date().toISOString().slice(0, 10),
    payment_method: 'bank_transfer',
    reference: '',
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGLReview, setShowGLReview] = useState(false);

  // Reset form when modal opens with new data
  React.useEffect(() => {
    if (open) {
      setForm({
        amount: amountDue,
        payment_date: new Date().toISOString().slice(0, 10),
        payment_method: 'bank_transfer',
        reference: '',
        notes: '',
      });
      setError('');
      setShowGLReview(false);
    }
  }, [open, amountDue]);

  const handleSubmit = () => {
    // Show GL review before recording
    setShowGLReview(true);
  };

  const handleGLAccept = async (journalLines) => {
    setShowGLReview(false);
    setSaving(true);
    setError('');
    try {
      await api.post(`/invoices/${invoiceId}/payments`, { ...form, journal_lines: journalLines });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to record payment');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Modal
        open={open && !showGLReview}
        onRequestClose={onClose}
        modalHeading="Record Payment"
        primaryButtonText={saving ? 'Saving...' : 'Record Payment'}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSubmit}
        primaryButtonDisabled={saving}
      >
        {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <TextInput
            id="pay-amount"
            labelText="Amount (RM)"
            type="number"
            step="0.01"
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
          />
          <DatePicker datePickerType="single" value={new Date(form.payment_date)}
            onChange={([d]) => { if (d) setForm(p => ({ ...p, payment_date: format(d, 'yyyy-MM-dd') })); }}>
            <DatePickerInput id="pay-date" labelText="Payment Date" placeholder="YYYY-MM-DD" />
          </DatePicker>
          <Select id="pay-method" labelText="Payment Method" value={form.payment_method}
            onChange={e => setForm(p => ({ ...p, payment_method: e.target.value }))}>
            <SelectItem value="bank_transfer" text="Bank Transfer" />
            <SelectItem value="cash" text="Cash" />
            <SelectItem value="cheque" text="Cheque" />
            <SelectItem value="online" text="Online Payment" />
            <SelectItem value="card" text="Credit/Debit Card" />
          </Select>
          <TextInput
            id="pay-ref"
            labelText="Reference / Transaction ID"
            value={form.reference}
            onChange={e => setForm(p => ({ ...p, reference: e.target.value }))}
            placeholder="Optional reference"
          />
        </div>
      </Modal>

      <GLReviewModal
        open={showGLReview}
        type="payment_received"
        data={{
          invoice_number: invoiceNumber || `Invoice #${invoiceId}`,
          amount: form.amount,
          method: form.payment_method,
        }}
        onAccept={handleGLAccept}
        onCancel={() => setShowGLReview(false)}
      />
    </>
  );
}
