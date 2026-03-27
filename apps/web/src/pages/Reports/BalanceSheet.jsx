import React, { useState } from 'react';
import {
  Tile,
  Button,
  DatePicker,
  DatePickerInput,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { Printer, DocumentPdf } from '@carbon/icons-react';
import { format } from 'date-fns';
import api from '../../services/api.js';

const fmt = (n) => `RM ${Number(n || 0).toFixed(2)}`;

function Section({ title, color, items, totalLabel, totalValue }) {
  return (
    <>
      <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: '#525252', background: '#f4f4f4', padding: '0.4rem 0.75rem', marginTop: '0.75rem' }}>{title}</h4>
      {items.length === 0 ? (
        <p style={{ color: '#8d8d8d', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}>None</p>
      ) : items.map(a => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.75rem', borderBottom: '1px solid #f4f4f4' }}>
          <span style={{ color: '#525252' }}>{a.code} — {a.name}</span>
          <span>{fmt(a.balance)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0.75rem', fontWeight: 700, borderTop: '1px solid #e0e0e0' }}>
        <span>{totalLabel}</span><span>{fmt(totalValue)}</span>
      </div>
    </>
  );
}

export default function BalanceSheetPage() {
  const [asAt, setAsAt] = useState(new Date().toISOString().split('T')[0]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/balance-sheet', { params: { as_at: asAt } });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await api.get('/reports/balance-sheet/pdf', { params: { as_at: asAt }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `BS-${asAt}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download PDF');
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Balance Sheet</h1>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} onClose={() => setError('')} />}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <DatePicker datePickerType="single" value={new Date(asAt)} onChange={([d]) => d && setAsAt(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="as_at" labelText="As at" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <Button onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate'}</Button>
        {report && (
          <>
            <Button kind="secondary" renderIcon={DocumentPdf} onClick={downloadPdf}>Download PDF</Button>
            <Button kind="ghost" renderIcon={Printer} onClick={() => window.print()}>Print</Button>
          </>
        )}
      </div>

      {loading && <InlineLoading description="Generating report..." />}

      {report && !loading && (
        <div>
          {/* ASSETS */}
          <Tile style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0e6027', marginBottom: '0.5rem', borderBottom: '2px solid #0e6027', paddingBottom: '0.5rem' }}>Assets</h3>
            <Section title="Current Assets" items={report.currentAssets} totalLabel="Total Current Assets" totalValue={report.totalCurrentAssets} />
            <Section title="Fixed Assets" items={report.fixedAssets} totalLabel="Total Fixed Assets" totalValue={report.totalFixedAssets} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', background: '#defbe6', marginTop: '0.75rem', borderRadius: '4px' }}>
              <span>Total Assets</span><span>{fmt(report.totalAssets)}</span>
            </div>
          </Tile>

          {/* LIABILITIES */}
          <Tile style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#da1e28', marginBottom: '0.5rem', borderBottom: '2px solid #da1e28', paddingBottom: '0.5rem' }}>Liabilities</h3>
            <Section title="Current Liabilities" items={report.currentLiabilities} totalLabel="Total Current Liabilities" totalValue={report.totalCurrentLiabilities} />
            <Section title="Long-term Liabilities" items={report.longTermLiabilities} totalLabel="Total Long-term Liabilities" totalValue={report.totalLongTermLiabilities} />
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', background: '#fff1e6', marginTop: '0.75rem', borderRadius: '4px' }}>
              <span>Total Liabilities</span><span>{fmt(report.totalLiabilities)}</span>
            </div>
          </Tile>

          {/* EQUITY */}
          <Tile style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f62fe', marginBottom: '0.5rem', borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Owner's Equity</h3>
            {report.equity.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.75rem', borderBottom: '1px solid #f4f4f4' }}>
                <span style={{ color: '#525252' }}>{a.code} — {a.name}</span>
                <span>{fmt(a.balance)}</span>
              </div>
            ))}
            {report.currentYearEarnings !== 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0.75rem', borderBottom: '1px solid #f4f4f4' }}>
                <span style={{ color: '#525252', fontStyle: 'italic' }}>Current Year Earnings</span>
                <span>{fmt(report.currentYearEarnings)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', fontWeight: 700, fontSize: '1.05rem', background: '#edf5ff', marginTop: '0.75rem', borderRadius: '4px' }}>
              <span>Total Owner's Equity</span><span>{fmt(report.totalEquity)}</span>
            </div>
          </Tile>

          {/* TOTAL CHECK */}
          <Tile style={{ padding: '1rem 1.5rem', background: Math.abs(report.totalAssets - report.totalLiabilitiesAndEquity) < 0.01 ? '#defbe6' : '#fff1e6', borderLeft: `4px solid ${Math.abs(report.totalAssets - report.totalLiabilitiesAndEquity) < 0.01 ? '#0e6027' : '#da1e28'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.15rem' }}>
              <span>Total Liabilities + Equity</span>
              <span>{fmt(report.totalLiabilitiesAndEquity)}</span>
            </div>
            {Math.abs(report.totalAssets - report.totalLiabilitiesAndEquity) >= 0.01 && (
              <p style={{ color: '#da1e28', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                Warning: Assets ({fmt(report.totalAssets)}) do not equal Liabilities + Equity ({fmt(report.totalLiabilitiesAndEquity)})
              </p>
            )}
          </Tile>
        </div>
      )}
    </div>
  );
}
