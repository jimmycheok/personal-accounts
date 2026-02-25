import React, { useState, useEffect } from 'react';
import {
  Tile,
  Accordion,
  AccordionItem,
  TextInput,
  Select,
  SelectItem,
  Button,
  InlineLoading,
  InlineNotification,
  Tag,
} from '@carbon/react';
import { Calculator } from '@carbon/icons-react';
import api from '../../services/api.js';

const PERSONAL_RELIEFS = [
  { id: 'self', label: 'Self & Dependent (Individual Relief)', max: 9000, default: 9000 },
  { id: 'medical_parents', label: 'Medical Treatment for Parents', max: 8000, default: 0 },
  { id: 'basic_supporting_equipment', label: 'Basic Supporting Equipment (Disabled)', max: 6000, default: 0 },
  { id: 'disabled_individual', label: 'Disabled Individual', max: 6000, default: 0 },
  { id: 'education', label: 'Education Fees (Self)', max: 7000, default: 0 },
  { id: 'medical_expenses', label: 'Medical & Dental Expenses (Self/Spouse/Child)', max: 10000, default: 0 },
  { id: 'lifestyle', label: 'Lifestyle (Books, Internet, Sport Equipment etc.)', max: 2500, default: 0 },
  { id: 'lifestyle_additional', label: 'Lifestyle Additional (Gym, Internet > 100Mbps etc.)', max: 2500, default: 0 },
  { id: 'epf', label: 'EPF / Life Insurance', max: 7000, default: 0 },
  { id: 'socso', label: 'SOCSO / EIS Contribution', max: 350, default: 0 },
  { id: 'private_retirement', label: 'Private Retirement Scheme (PRS)', max: 3000, default: 0 },
  { id: 'child_under_18', label: 'Child Relief (Under 18)', max: null, default: 0 },
  { id: 'zakat', label: 'Zakat / Fitrah', max: null, default: 0 },
];

const MY_TAX_BRACKETS = [
  { min: 0, max: 5000, rate: 0 },
  { min: 5001, max: 20000, rate: 1 },
  { min: 20001, max: 35000, rate: 3 },
  { min: 35001, max: 50000, rate: 8 },
  { min: 50001, max: 70000, rate: 13 },
  { min: 70001, max: 100000, rate: 21 },
  { min: 100001, max: 250000, rate: 24 },
  { min: 250001, max: 400000, rate: 24.5 },
  { min: 400001, max: 600000, rate: 25 },
  { min: 600001, max: 1000000, rate: 26 },
  { min: 1000001, max: Infinity, rate: 30 },
];

function calcMalaysiaTax(chargeable) {
  let tax = 0;
  for (const bracket of MY_TAX_BRACKETS) {
    if (chargeable <= bracket.min) break;
    const taxable = Math.min(chargeable, bracket.max) - bracket.min;
    tax += taxable * (bracket.rate / 100);
  }
  return tax;
}

export default function TaxationPage() {
  const [yearData, setYearData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(String(new Date().getFullYear() - 1));
  const [reliefs, setReliefs] = useState(() =>
    Object.fromEntries(PERSONAL_RELIEFS.map(r => [r.id, r.default]))
  );
  const [calculated, setCalculated] = useState(null);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get(`/taxation/summary?year=${year}`)
      .then(res => setYearData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [year]);

  const updateRelief = (id, val) => {
    const relief = PERSONAL_RELIEFS.find(r => r.id === id);
    const num = Number(val) || 0;
    const capped = relief?.max ? Math.min(num, relief.max) : num;
    setReliefs(p => ({ ...p, [id]: capped }));
  };

  const handleCalculate = async () => {
    setCalculating(true);
    setError('');
    try {
      const res = await api.post('/taxation/estimate', { year, reliefs });
      setCalculated(res.data);
    } catch (err) {
      // Fallback: calculate client-side
      const grossIncome = yearData?.totalIncome || 0;
      const totalExpenses = yearData?.totalExpenses || 0;
      const netBusiness = grossIncome - totalExpenses;
      const totalRelief = Object.values(reliefs).reduce((s, v) => s + Number(v), 0);
      const chargeable = Math.max(0, netBusiness - totalRelief);
      const tax = calcMalaysiaTax(chargeable);
      setCalculated({
        gross_income: grossIncome,
        total_expenses: totalExpenses,
        net_business_income: netBusiness,
        total_reliefs: totalRelief,
        chargeable_income: chargeable,
        estimated_tax: tax,
        effective_rate: chargeable > 0 ? ((tax / chargeable) * 100).toFixed(2) : 0,
      });
    } finally {
      setCalculating(false);
    }
  };

  const years = Array.from({ length: 5 }, (_, i) => String(new Date().getFullYear() - i));

  if (loading) return <InlineLoading description="Loading tax data..." />;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Taxation — Borang B</h1>
        <Select id="tax-year" labelText="" value={year} onChange={e => setYear(e.target.value)} style={{ width: 160 }}>
          {years.map(y => <SelectItem key={y} value={y} text={`Year of Assessment ${y}`} />)}
        </Select>
      </div>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, color: '#525252', marginBottom: '1rem' }}>Business Income Summary ({year})</h4>
          {[
            ['Total Revenue', yearData?.totalIncome, '#0e6027'],
            ['Total Expenses', yearData?.totalExpenses, '#da1e28'],
            ['Net Business Income', yearData?.netProfit, '#0f62fe'],
          ].map(([label, val, color]) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid #e0e0e0' }}>
              <span style={{ color: '#525252' }}>{label}</span>
              <span style={{ fontWeight: 700, color }}>RM {Number(val || 0).toFixed(2)}</span>
            </div>
          ))}
        </Tile>
        {calculated && (
          <Tile style={{ padding: '1.5rem', background: '#d0e2ff' }}>
            <h4 style={{ fontWeight: 700, color: '#0043ce', marginBottom: '1rem' }}>Tax Estimate</h4>
            {[
              ['Net Business Income', calculated.net_business_income],
              ['Total Reliefs', calculated.total_reliefs],
              ['Chargeable Income', calculated.chargeable_income],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <span style={{ color: '#525252' }}>{label}</span>
                <span style={{ fontWeight: 600 }}>RM {Number(val || 0).toFixed(2)}</span>
              </div>
            ))}
            <div style={{ borderTop: '2px solid #0043ce', paddingTop: '0.75rem', marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>Estimated Tax</span>
              <span style={{ fontWeight: 700, fontSize: '1.25rem', color: '#da1e28' }}>
                RM {Number(calculated.estimated_tax || 0).toFixed(2)}
              </span>
            </div>
            <div style={{ textAlign: 'right', marginTop: '0.25rem' }}>
              <Tag type="blue">Effective Rate: {calculated.effective_rate}%</Tag>
            </div>
          </Tile>
        )}
      </div>

      <Accordion>
        <AccordionItem title="Personal Reliefs — Enter your eligible deductions">
          <div style={{ padding: '1rem 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {PERSONAL_RELIEFS.map(relief => (
                <TextInput
                  key={relief.id}
                  id={`relief-${relief.id}`}
                  labelText={`${relief.label}${relief.max ? ` (max RM ${relief.max.toLocaleString()})` : ''}`}
                  type="number"
                  step="0.01"
                  value={reliefs[relief.id]}
                  onChange={e => updateRelief(relief.id, e.target.value)}
                />
              ))}
            </div>
          </div>
        </AccordionItem>

        <AccordionItem title="Malaysia Income Tax Rates (YA 2024)">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f4f4f4' }}>
                <th style={{ padding: '0.5rem', textAlign: 'left' }}>Chargeable Income (RM)</th>
                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Tax Rate (%)</th>
              </tr>
            </thead>
            <tbody>
              {MY_TAX_BRACKETS.map((b, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.5rem' }}>
                    {b.max === Infinity
                      ? `Over RM ${b.min.toLocaleString()}`
                      : `RM ${b.min.toLocaleString()} – RM ${b.max.toLocaleString()}`}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: b.rate > 0 ? 600 : 400 }}>
                    {b.rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </AccordionItem>
      </Accordion>

      <div style={{ marginTop: '1.5rem', textAlign: 'right' }}>
        <Button renderIcon={Calculator} onClick={handleCalculate} disabled={calculating}>
          {calculating ? 'Calculating...' : 'Calculate Tax Estimate'}
        </Button>
      </div>
    </div>
  );
}
