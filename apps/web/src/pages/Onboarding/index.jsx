import React, { useState } from 'react';
import {
  ProgressIndicator,
  ProgressStep,
  Tile,
  TextInput,
  Select,
  SelectItem,
  Button,
  Toggle,
  InlineNotification,
  Form,
} from '@carbon/react';
import { useNavigate } from 'react-router-dom';
import { useAppSettings } from '../../context/AppSettingsContext.jsx';
import api from '../../services/api.js';

const STEPS = ['Business Info', 'E-Invoice Setup', 'Storage', 'Review'];

function StepBusinessInfo({ data, onChange }) {
  return (
    <div>
      <h3 className="form-section-title">Business Information</h3>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput
          id="business_name"
          labelText="Business Name *"
          value={data.business_name || ''}
          onChange={e => onChange('business_name', e.target.value)}
          placeholder="Your business name"
        />
        <TextInput
          id="registration_number"
          labelText="ROB/IC Number *"
          value={data.registration_number || ''}
          onChange={e => onChange('registration_number', e.target.value)}
          placeholder="e.g. 001234567-A or 900101-01-1234"
        />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput
          id="tax_identification_number"
          labelText="Tax Identification Number (TIN)"
          value={data.tax_identification_number || ''}
          onChange={e => onChange('tax_identification_number', e.target.value)}
          placeholder="e.g. IG12345678090"
        />
        <TextInput
          id="sst_number"
          labelText="SST Registration Number"
          value={data.sst_number || ''}
          onChange={e => onChange('sst_number', e.target.value)}
          placeholder="Leave blank if not SST-registered"
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <TextInput
          id="address"
          labelText="Business Address *"
          value={data.address || ''}
          onChange={e => onChange('address', e.target.value)}
          placeholder="Full business address"
        />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput
          id="phone"
          labelText="Phone Number"
          value={data.phone || ''}
          onChange={e => onChange('phone', e.target.value)}
          placeholder="+60 12-345 6789"
        />
        <TextInput
          id="email"
          labelText="Business Email"
          value={data.email || ''}
          onChange={e => onChange('email', e.target.value)}
          placeholder="you@business.com"
        />
      </div>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <Select
          id="currency"
          labelText="Default Currency"
          value={data.currency || 'MYR'}
          onChange={e => onChange('currency', e.target.value)}
        >
          <SelectItem value="MYR" text="MYR — Malaysian Ringgit" />
          <SelectItem value="USD" text="USD — US Dollar" />
          <SelectItem value="SGD" text="SGD — Singapore Dollar" />
        </Select>
        <Select
          id="fiscal_year_start"
          labelText="Fiscal Year Start"
          value={data.fiscal_year_start || '01'}
          onChange={e => onChange('fiscal_year_start', e.target.value)}
        >
          {['01','02','03','04','05','06','07','08','09','10','11','12'].map(m => (
            <SelectItem key={m} value={m} text={new Date(2024, Number(m)-1).toLocaleString('default', { month: 'long' })} />
          ))}
        </Select>
      </div>
    </div>
  );
}

function StepEInvoice({ data, onChange }) {
  return (
    <div>
      <h3 className="form-section-title">MyInvois E-Invoice Configuration</h3>
      <p style={{ color: '#525252', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Configure your LHDN MyInvois credentials for e-invoice submission. Leave blank if not applicable.
      </p>
      <div className="grid-2" style={{ marginBottom: '1rem' }}>
        <TextInput
          id="myinvois_client_id"
          labelText="MyInvois Client ID"
          value={data.myinvois_client_id || ''}
          onChange={e => onChange('myinvois_client_id', e.target.value)}
          placeholder="Client ID from MyInvois portal"
        />
        <TextInput.PasswordInput
          id="myinvois_client_secret"
          labelText="MyInvois Client Secret"
          value={data.myinvois_client_secret || ''}
          onChange={e => onChange('myinvois_client_secret', e.target.value)}
          placeholder="Client secret"
        />
      </div>
      <div style={{ marginBottom: '1rem' }}>
        <Toggle
          id="myinvois_sandbox"
          labelText="Use Sandbox Environment"
          labelA="Production"
          labelB="Sandbox"
          toggled={data.myinvois_sandbox !== false}
          onToggle={val => onChange('myinvois_sandbox', val)}
        />
        <p style={{ fontSize: '0.75rem', color: '#8d8d8d', marginTop: '0.5rem' }}>
          Use sandbox for testing before going live with production.
        </p>
      </div>
    </div>
  );
}

function StepStorage({ data, onChange }) {
  return (
    <div>
      <h3 className="form-section-title">Document Storage</h3>
      <p style={{ color: '#525252', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Configure where your documents (receipts, invoices) will be stored.
      </p>
      <div style={{ marginBottom: '1rem' }}>
        <Select
          id="storage_provider"
          labelText="Storage Provider"
          value={data.storage_provider || 'local'}
          onChange={e => onChange('storage_provider', e.target.value)}
        >
          <SelectItem value="local" text="Local Storage (Default)" />
          <SelectItem value="s3" text="Amazon S3" />
          <SelectItem value="r2" text="Cloudflare R2" />
        </Select>
      </div>
      {(data.storage_provider === 's3' || data.storage_provider === 'r2') && (
        <div>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <TextInput
              id="storage_bucket"
              labelText="Bucket Name"
              value={data.storage_bucket || ''}
              onChange={e => onChange('storage_bucket', e.target.value)}
            />
            <TextInput
              id="storage_region"
              labelText="Region / Endpoint"
              value={data.storage_region || ''}
              onChange={e => onChange('storage_region', e.target.value)}
            />
          </div>
          <div className="grid-2" style={{ marginBottom: '1rem' }}>
            <TextInput
              id="storage_access_key"
              labelText="Access Key ID"
              value={data.storage_access_key || ''}
              onChange={e => onChange('storage_access_key', e.target.value)}
            />
            <TextInput.PasswordInput
              id="storage_secret_key"
              labelText="Secret Access Key"
              value={data.storage_secret_key || ''}
              onChange={e => onChange('storage_secret_key', e.target.value)}
            />
          </div>
        </div>
      )}
      {data.storage_provider === 'local' && (
        <div style={{ padding: '1rem', background: '#d0e2ff', borderRadius: '4px' }}>
          <p style={{ margin: 0, fontSize: '0.875rem', color: '#003188' }}>
            Files will be stored in the <strong>uploads/</strong> directory on the server. Suitable for single-server deployments.
          </p>
        </div>
      )}
    </div>
  );
}

function StepReview({ businessData, einvoiceData, storageData }) {
  const rows = [
    { label: 'Business Name', value: businessData.business_name },
    { label: 'ROB/IC Number', value: businessData.registration_number },
    { label: 'TIN', value: businessData.tax_identification_number || 'Not provided' },
    { label: 'SST Number', value: businessData.sst_number || 'Not registered' },
    { label: 'Currency', value: businessData.currency || 'MYR' },
    { label: 'E-Invoice', value: einvoiceData.myinvois_client_id ? `Configured (${einvoiceData.myinvois_sandbox !== false ? 'Sandbox' : 'Production'})` : 'Not configured' },
    { label: 'Storage', value: storageData.storage_provider || 'local' },
  ];
  return (
    <div>
      <h3 className="form-section-title">Review Your Settings</h3>
      <p style={{ color: '#525252', marginBottom: '1.5rem', fontSize: '0.875rem' }}>
        Please review your configuration before completing setup.
      </p>
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '4px', overflow: 'hidden' }}>
        {rows.map((row, idx) => (
          <div key={idx} style={{
            display: 'flex',
            padding: '0.75rem 1rem',
            backgroundColor: idx % 2 === 0 ? '#f4f4f4' : '#ffffff',
            borderBottom: idx < rows.length - 1 ? '1px solid #e0e0e0' : 'none',
          }}>
            <span style={{ fontWeight: 600, width: '220px', flexShrink: 0, color: '#525252' }}>{row.label}</span>
            <span style={{ color: '#161616' }}>{row.value || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { refresh } = useAppSettings();
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [businessData, setBusinessData] = useState({
    business_name: '', registration_number: '', tax_identification_number: '',
    sst_number: '', address: '', phone: '', email: '', currency: 'MYR', fiscal_year_start: '01',
  });
  const [einvoiceData, setEinvoiceData] = useState({
    myinvois_client_id: '', myinvois_client_secret: '', myinvois_sandbox: true,
  });
  const [storageData, setStorageData] = useState({
    storage_provider: 'local', storage_bucket: '', storage_region: '',
    storage_access_key: '', storage_secret_key: '',
  });

  const updateBusiness = (key, val) => setBusinessData(p => ({ ...p, [key]: val }));
  const updateEinvoice = (key, val) => setEinvoiceData(p => ({ ...p, [key]: val }));
  const updateStorage = (key, val) => setStorageData(p => ({ ...p, [key]: val }));

  const handleNext = () => {
    if (currentStep === 0 && !businessData.business_name) {
      setError('Business name is required');
      return;
    }
    setError('');
    setCurrentStep(s => s + 1);
  };

  const handleComplete = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post('/onboarding/complete', {
        ...businessData,
        ...einvoiceData,
        ...storageData,
      });
      await refresh();
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Setup failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f4f4f4', display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: '3rem', paddingBottom: '3rem' }}>
      <div style={{ width: '100%', maxWidth: '800px', padding: '0 1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 300, color: '#0f62fe', marginBottom: '0.5rem' }}>Welcome to Personal Accountant</h1>
        <p style={{ color: '#525252', marginBottom: '2rem' }}>Let's set up your accounting system in a few steps.</p>

        <ProgressIndicator currentIndex={currentStep} style={{ marginBottom: '2rem' }}>
          {STEPS.map((step, idx) => (
            <ProgressStep key={idx} label={step} />
          ))}
        </ProgressIndicator>

        <Tile style={{ padding: '2rem', marginBottom: '1.5rem' }}>
          {error && (
            <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />
          )}

          {currentStep === 0 && <StepBusinessInfo data={businessData} onChange={updateBusiness} />}
          {currentStep === 1 && <StepEInvoice data={einvoiceData} onChange={updateEinvoice} />}
          {currentStep === 2 && <StepStorage data={storageData} onChange={updateStorage} />}
          {currentStep === 3 && (
            <StepReview businessData={businessData} einvoiceData={einvoiceData} storageData={storageData} />
          )}
        </Tile>

        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Button
            kind="secondary"
            onClick={() => setCurrentStep(s => s - 1)}
            disabled={currentStep === 0}
          >
            Back
          </Button>
          {currentStep < STEPS.length - 1 ? (
            <Button onClick={handleNext}>Next</Button>
          ) : (
            <Button onClick={handleComplete} disabled={saving}>
              {saving ? 'Completing setup...' : 'Complete Setup'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
