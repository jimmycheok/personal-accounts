import React, { useState } from 'react';
import { Modal, TextInput, Select, SelectItem, InlineNotification } from '@carbon/react';
import api from '../services/api.js';

const EMPTY = { name: '', customer_type: 'B2B', email: '', phone: '' };

export default function CustomerQuickCreateModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Customer name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await api.post('/customers', form);
      onCreated(res.data);
      setForm(EMPTY);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create customer');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setForm(EMPTY);
    setError('');
    onClose();
  };

  return (
    <Modal
      open={open}
      modalHeading="New Customer"
      primaryButtonText={saving ? 'Creating...' : 'Create Customer'}
      secondaryButtonText="Cancel"
      onRequestSubmit={handleSubmit}
      onRequestClose={handleClose}
      primaryButtonDisabled={saving}
      size="sm"
    >
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      <TextInput
        id="qc-name"
        labelText="Name *"
        value={form.name}
        onChange={e => update('name', e.target.value)}
        placeholder="Company or person name"
        style={{ marginBottom: '1rem' }}
      />
      <Select
        id="qc-type"
        labelText="Customer Type"
        value={form.customer_type}
        onChange={e => update('customer_type', e.target.value)}
        style={{ marginBottom: '1rem' }}
      >
        <SelectItem value="B2B" text="B2B — Business" />
        <SelectItem value="B2C" text="B2C — Individual" />
        <SelectItem value="B2G" text="B2G — Government" />
      </Select>
      <TextInput
        id="qc-email"
        labelText="Email"
        value={form.email}
        onChange={e => update('email', e.target.value)}
        placeholder="email@example.com"
        style={{ marginBottom: '1rem' }}
      />
      <TextInput
        id="qc-phone"
        labelText="Phone"
        value={form.phone}
        onChange={e => update('phone', e.target.value)}
        placeholder="+601X-XXXXXXX"
      />
    </Modal>
  );
}
