import React, { useState, useEffect } from 'react';
import {
  Tabs,
  Tab,
  TabList,
  TabPanels,
  TabPanel,
  Tile,
  TextInput,
  PasswordInput,
  Select,
  SelectItem,
  Button,
  Toggle,
  InlineNotification,
  InlineLoading,
  Tag,
  TextArea,
} from '@carbon/react';
import { Save } from '@carbon/icons-react';
import api from '../../services/api.js';

function BusinessProfileTab() {
  const [form, setForm] = useState({
    business_name: '', registration_number: '', tax_identification_number: '',
    sst_number: '', address_line1: '', address_line2: '', city: '', postcode: '',
    state: '', country: 'Malaysia', phone: '', email: '', website: '',
    currency: 'MYR', fiscal_year_start: '01', invoice_prefix: 'INV-',
    quotation_prefix: 'QT-', invoice_notes: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/settings/business-profile')
      .then(res => setForm(p => ({ ...p, ...res.data })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.put('/settings/business-profile', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (loading) return <InlineLoading description="Loading profile..." />;

  return (
    <div>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      {success && <InlineNotification kind="success" title="Settings saved successfully" style={{ marginBottom: '1rem' }} />}

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-biz-name" labelText="Business Name *" value={form.business_name || ''}
          onChange={e => update('business_name', e.target.value)} />
        <TextInput id="s-reg" labelText="ROB/IC Number" value={form.registration_number || ''}
          onChange={e => update('registration_number', e.target.value)} />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-tin" labelText="Tax Identification Number (TIN)" value={form.tax_identification_number || ''}
          onChange={e => update('tax_identification_number', e.target.value)} />
        <TextInput id="s-sst" labelText="SST Registration Number" value={form.sst_number || ''}
          onChange={e => update('sst_number', e.target.value)} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <TextInput id="s-addr1" labelText="Address Line 1" value={form.address_line1 || ''}
          onChange={e => update('address_line1', e.target.value)} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <TextInput id="s-addr2" labelText="Address Line 2" value={form.address_line2 || ''}
          onChange={e => update('address_line2', e.target.value)} />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-city" labelText="City" value={form.city || ''}
          onChange={e => update('city', e.target.value)} />
        <TextInput id="s-postcode" labelText="Postcode" value={form.postcode || ''}
          onChange={e => update('postcode', e.target.value)} />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-state" labelText="State" value={form.state || ''}
          onChange={e => update('state', e.target.value)} />
        <TextInput id="s-country" labelText="Country" value={form.country || ''}
          onChange={e => update('country', e.target.value)} />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-phone" labelText="Phone" value={form.phone || ''}
          onChange={e => update('phone', e.target.value)} />
        <TextInput id="s-email" labelText="Business Email" value={form.email || ''}
          onChange={e => update('email', e.target.value)} />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-web" labelText="Website" value={form.website || ''}
          onChange={e => update('website', e.target.value)} />
        <Select id="s-currency" labelText="Default Currency" value={form.currency || 'MYR'}
          onChange={e => update('currency', e.target.value)}>
          <SelectItem value="MYR" text="MYR — Malaysian Ringgit" />
          <SelectItem value="USD" text="USD — US Dollar" />
          <SelectItem value="SGD" text="SGD — Singapore Dollar" />
        </Select>
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-inv-prefix" labelText="Invoice Number Prefix" value={form.invoice_prefix || 'INV-'}
          onChange={e => update('invoice_prefix', e.target.value)} />
        <TextInput id="s-qt-prefix" labelText="Quotation Number Prefix" value={form.quotation_prefix || 'QT-'}
          onChange={e => update('quotation_prefix', e.target.value)} />
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <TextArea id="s-inv-notes" labelText="Default Invoice Notes / Payment Instructions" value={form.invoice_notes || ''}
          onChange={e => update('invoice_notes', e.target.value)} rows={3}
          placeholder="e.g. Please make payment to Maybank account 1234567890 (Company Name Sdn Bhd)" />
      </div>
      <Button renderIcon={Save} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Profile'}
      </Button>
    </div>
  );
}

function EInvoiceTab() {
  const [form, setForm] = useState({
    myinvois_client_id: '', myinvois_client_secret: '',
    myinvois_sandbox: true, auto_submit: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/settings/einvoice-config')
      .then(res => setForm(p => ({ ...p, ...res.data })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.put('/settings/einvoice-config', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/einvoice-config/test');
      setTestResult({ success: true, message: res.data.message || 'Connection successful!' });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <InlineLoading description="Loading e-invoice settings..." />;

  return (
    <div>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      {success && <InlineNotification kind="success" title="E-Invoice settings saved" style={{ marginBottom: '1rem' }} />}
      {testResult && (
        <InlineNotification kind={testResult.success ? 'success' : 'error'} title={testResult.message} style={{ marginBottom: '1rem' }} />
      )}

      <p style={{ color: '#525252', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Configure your LHDN MyInvois API credentials for electronic invoice submission (mandatory for B2B transactions above RM 500).
      </p>

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-ei-id" labelText="MyInvois Client ID" value={form.myinvois_client_id || ''}
          onChange={e => setForm(p => ({ ...p, myinvois_client_id: e.target.value }))} />
        <PasswordInput id="s-ei-secret" labelText="MyInvois Client Secret" value={form.myinvois_client_secret || ''}
          onChange={e => setForm(p => ({ ...p, myinvois_client_secret: e.target.value }))} />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <Toggle id="s-ei-sandbox" labelText="Environment" labelA="Production" labelB="Sandbox"
          toggled={form.myinvois_sandbox !== false}
          onToggle={val => setForm(p => ({ ...p, myinvois_sandbox: val }))} />
        <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginTop: '0.5rem' }}>
          Current: <Tag type={form.myinvois_sandbox !== false ? 'cyan' : 'green'}>
            {form.myinvois_sandbox !== false ? 'Sandbox' : 'Production'}
          </Tag>
        </p>
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Toggle id="s-ei-auto" labelText="Auto-submit invoices to MyInvois" labelA="Manual" labelB="Auto"
          toggled={form.auto_submit === true}
          onToggle={val => setForm(p => ({ ...p, auto_submit: val }))} />
        <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginTop: '0.5rem' }}>
          When enabled, invoices will be automatically submitted upon marking as sent.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '1rem' }}>
        <Button renderIcon={Save} onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save E-Invoice Settings'}
        </Button>
        <Button kind="secondary" onClick={handleTest} disabled={testing}>
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
      </div>
    </div>
  );
}

function StorageTab() {
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  useEffect(() => {
    api.get('/settings/storage-config')
      .then(res => setUsage(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.post('/settings/storage-config/test');
      setTestResult({ success: true, message: res.data.message || 'MinIO connection successful!' });
    } catch (err) {
      setTestResult({ success: false, message: err.response?.data?.error || 'Connection failed' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <InlineLoading description="Loading storage settings..." />;

  const usedMB = usage?.usedBytes ? (usage.usedBytes / (1024 * 1024)).toFixed(2) : '0.00';

  return (
    <div>
      {testResult && (
        <InlineNotification kind={testResult.success ? 'success' : 'error'} title={testResult.message} style={{ marginBottom: '1rem' }} />
      )}

      <div style={{ padding: '1rem', background: '#f4f4f4', borderRadius: '4px', marginBottom: '1.5rem' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#161616', fontWeight: 600, marginBottom: '0.5rem' }}>
          MinIO Object Storage
        </p>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#525252' }}>
          All documents (receipts, invoices, attachments) are stored in MinIO, an S3-compatible object storage running locally via Docker.
          You can browse and manage files through the MinIO Console.
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#525252' }}>
          <strong>MinIO Console:</strong>{' '}
          <a href="http://localhost:9001" target="_blank" rel="noopener noreferrer" style={{ color: '#0f62fe' }}>
            http://localhost:9001
          </a>
          {' '}(Username: <code>pa_minio</code> / Password: <code>pa_minio_secret</code>)
        </p>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.875rem', color: '#525252' }}>
          <strong>Bucket:</strong> <code>pa-documents</code> | <strong>Storage Used:</strong> {usedMB} MB
        </p>
      </div>

      <Button kind="secondary" onClick={handleTest} disabled={testing}>
        {testing ? 'Testing...' : 'Test Connection'}
      </Button>
    </div>
  );
}

function PreferencesTab() {
  const [form, setForm] = useState({
    date_format: 'DD/MM/YYYY',
    invoice_due_days: 30,
    send_reminders: true,
    reminder_days_before: 3,
    reminder_days_after: [1, 7, 14],
    low_stock_alert: false,
    currency_symbol: 'RM',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/settings/preferences')
      .then(res => setForm(p => ({ ...p, ...res.data })))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put('/settings/preferences', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (loading) return <InlineLoading description="Loading preferences..." />;

  return (
    <div>
      {success && <InlineNotification kind="success" title="Preferences saved" style={{ marginBottom: '1rem' }} />}

      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <Select id="s-date-fmt" labelText="Date Format" value={form.date_format}
          onChange={e => update('date_format', e.target.value)}>
          <SelectItem value="DD/MM/YYYY" text="DD/MM/YYYY (Malaysia Standard)" />
          <SelectItem value="YYYY-MM-DD" text="YYYY-MM-DD (ISO)" />
          <SelectItem value="MM/DD/YYYY" text="MM/DD/YYYY (US)" />
        </Select>
        <Select id="s-due-days" labelText="Default Invoice Due Days" value={String(form.invoice_due_days)}
          onChange={e => update('invoice_due_days', Number(e.target.value))}>
          <SelectItem value="0" text="Due on Receipt" />
          <SelectItem value="7" text="7 Days" />
          <SelectItem value="14" text="14 Days" />
          <SelectItem value="30" text="30 Days" />
          <SelectItem value="60" text="60 Days" />
        </Select>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <Toggle id="s-reminders" labelText="Invoice Payment Reminders" labelA="Disabled" labelB="Enabled"
          toggled={form.send_reminders === true} onToggle={val => update('send_reminders', val)} />
        <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginTop: '0.5rem' }}>
          Automatically send reminder emails for outstanding invoices.
        </p>
      </div>

      {form.send_reminders && (
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <Select id="s-remind-before" labelText="Remind Before Due (days)" value={String(form.reminder_days_before)}
            onChange={e => update('reminder_days_before', Number(e.target.value))}>
            <SelectItem value="1" text="1 Day" />
            <SelectItem value="3" text="3 Days" />
            <SelectItem value="7" text="7 Days" />
          </Select>
        </div>
      )}

      <div style={{ marginBottom: '1.5rem', padding: '0.75rem 1rem', background: '#f4f4f4', borderRadius: '4px' }}>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#525252' }}>
          To change your password, use <strong>Settings → Security</strong> or call <code>PUT /api/v1/auth/change-password</code>.
        </p>
      </div>

      <Button renderIcon={Save} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Preferences'}
      </Button>
    </div>
  );
}

function BankingTab() {
  const [form, setForm] = useState({
    bank_name: '', bank_account_name: '', bank_account_number: '',
    default_payment_terms: 30,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/settings/banking')
      .then(res => setForm(p => ({ ...p, ...res.data })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.put('/settings/banking', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  if (loading) return <InlineLoading description="Loading banking details..." />;

  return (
    <div>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      {success && <InlineNotification kind="success" title="Banking details saved" style={{ marginBottom: '1rem' }} />}

      <p style={{ color: '#525252', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Bank details shown on invoices and used for DuitNow QR code generation.
      </p>

      <div style={{ marginBottom: '1rem' }}>
        <TextInput id="s-bank-name" labelText="Bank Name" value={form.bank_name || ''}
          onChange={e => update('bank_name', e.target.value)} placeholder="e.g. Maybank, CIMB, Public Bank" />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput id="s-bank-acc-name" labelText="Account Holder Name" value={form.bank_account_name || ''}
          onChange={e => update('bank_account_name', e.target.value)} />
        <TextInput id="s-bank-acc-num" labelText="Account Number" value={form.bank_account_number || ''}
          onChange={e => update('bank_account_number', e.target.value)} />
      </div>
      <div style={{ marginBottom: '1.5rem' }}>
        <Select id="s-payment-terms" labelText="Default Payment Terms" value={String(form.default_payment_terms || 30)}
          onChange={e => update('default_payment_terms', Number(e.target.value))}>
          <SelectItem value="0" text="Due on Receipt" />
          <SelectItem value="7" text="Net 7 Days" />
          <SelectItem value="14" text="Net 14 Days" />
          <SelectItem value="30" text="Net 30 Days" />
          <SelectItem value="60" text="Net 60 Days" />
          <SelectItem value="90" text="Net 90 Days" />
        </Select>
      </div>

      <Button renderIcon={Save} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Banking Details'}
      </Button>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <div className="page-container">
      <h1 className="page-title">Settings</h1>

      <Tile style={{ padding: '1.5rem' }}>
        <Tabs>
          <TabList aria-label="Settings tabs">
            <Tab>Business Profile</Tab>
            <Tab>Banking</Tab>
            <Tab>E-Invoice</Tab>
            <Tab>Storage</Tab>
            <Tab>Preferences</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><BusinessProfileTab /></TabPanel>
            <TabPanel><BankingTab /></TabPanel>
            <TabPanel><EInvoiceTab /></TabPanel>
            <TabPanel><StorageTab /></TabPanel>
            <TabPanel><PreferencesTab /></TabPanel>
          </TabPanels>
        </Tabs>
      </Tile>
    </div>
  );
}
