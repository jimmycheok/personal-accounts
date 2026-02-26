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
import { Save, Checkmark } from '@carbon/icons-react';
import api from '../../services/api.js';

function BusinessProfileTab() {
  const [form, setForm] = useState({
    business_name: '', registration_number: '', tax_identification_number: '',
    sst_number: '', address: '', phone: '', email: '', website: '',
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
        <TextArea id="s-addr" labelText="Business Address" value={form.address || ''}
          onChange={e => update('address', e.target.value)} rows={3} />
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
  const [form, setForm] = useState({
    storage_provider: 'local', storage_bucket: '', storage_region: '',
    storage_access_key: '', storage_secret_key: '', storage_prefix: 'pa-docs/',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/settings/storage-config')
      .then(res => setForm(p => ({ ...p, ...res.data })))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess(false);
    try {
      await api.put('/settings/storage-config', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoading description="Loading storage settings..." />;

  return (
    <div>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      {success && <InlineNotification kind="success" title="Storage settings saved" style={{ marginBottom: '1rem' }} />}

      <div style={{ marginBottom: '1rem' }}>
        <Select id="s-storage" labelText="Storage Provider" value={form.storage_provider}
          onChange={e => setForm(p => ({ ...p, storage_provider: e.target.value }))}>
          <SelectItem value="local" text="Local Storage" />
          <SelectItem value="s3" text="Amazon S3" />
          <SelectItem value="r2" text="Cloudflare R2" />
        </Select>
      </div>

      {form.storage_provider === 'local' && (
        <div style={{ padding: '1rem', background: '#d0e2ff', borderRadius: '4px', marginBottom: '1.5rem' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#003188' }}>
            Files stored in <code>uploads/</code> on the server. Suitable for single-server deployments.
          </p>
        </div>
      )}

      {(form.storage_provider === 's3' || form.storage_provider === 'r2') && (
        <div>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <TextInput id="s-bucket" labelText="Bucket Name" value={form.storage_bucket || ''}
              onChange={e => setForm(p => ({ ...p, storage_bucket: e.target.value }))} />
            <TextInput id="s-region" labelText={form.storage_provider === 'r2' ? 'R2 Endpoint URL' : 'Region'}
              value={form.storage_region || ''}
              onChange={e => setForm(p => ({ ...p, storage_region: e.target.value }))}
              placeholder={form.storage_provider === 'r2' ? 'https://xxx.r2.cloudflarestorage.com' : 'ap-southeast-1'} />
          </div>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <TextInput id="s-ak" labelText="Access Key ID" value={form.storage_access_key || ''}
              onChange={e => setForm(p => ({ ...p, storage_access_key: e.target.value }))} />
            <PasswordInput id="s-sk" labelText="Secret Access Key" value={form.storage_secret_key || ''}
              onChange={e => setForm(p => ({ ...p, storage_secret_key: e.target.value }))} />
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <TextInput id="s-prefix" labelText="Object Key Prefix" value={form.storage_prefix || ''}
              onChange={e => setForm(p => ({ ...p, storage_prefix: e.target.value }))}
              placeholder="pa-docs/" helperText="Files will be stored under this path prefix in your bucket" />
          </div>
        </div>
      )}

      <Button renderIcon={Save} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Storage Settings'}
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

      <div style={{ marginBottom: '1.5rem' }}>
        <Toggle id="s-change-pw-toggle" labelText="Password Change" labelA="" labelB=""
          toggled={false} onToggle={() => {}} />
        <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginTop: '0.5rem' }}>
          To change your password, use the API endpoint <code>PUT /api/v1/auth/change-password</code>.
        </p>
      </div>

      <Button renderIcon={Save} onClick={handleSave} disabled={saving}>
        {saving ? 'Saving...' : 'Save Preferences'}
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
            <Tab>E-Invoice</Tab>
            <Tab>Storage</Tab>
            <Tab>Preferences</Tab>
          </TabList>
          <TabPanels>
            <TabPanel><BusinessProfileTab /></TabPanel>
            <TabPanel><EInvoiceTab /></TabPanel>
            <TabPanel><StorageTab /></TabPanel>
            <TabPanel><PreferencesTab /></TabPanel>
          </TabPanels>
        </Tabs>
      </Tile>
    </div>
  );
}
