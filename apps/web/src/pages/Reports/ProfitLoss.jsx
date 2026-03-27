import React, { useState } from 'react';
import {
  Tile,
  Button,
  DatePicker,
  DatePickerInput,
  InlineLoading,
  InlineNotification,
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@carbon/react';
import { Printer, DocumentPdf, Reset } from '@carbon/icons-react';
import { format } from 'date-fns';
import api from '../../services/api.js';

const fmt = (n) => `RM ${Number(n || 0).toFixed(2)}`;

export default function ProfitLossPage() {
  const year = new Date().getFullYear();
  const [from, setFrom] = useState(`${year}-01-01`);
  const [to, setTo] = useState(`${year}-12-31`);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closeResult, setCloseResult] = useState(null);

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/reports/profit-loss', { params: { from, to } });
      setReport(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to generate report');
    } finally {
      setLoading(false);
    }
  };

  const downloadPdf = async () => {
    try {
      const res = await api.get('/reports/profit-loss/pdf', { params: { from, to }, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `PL-${from}-to-${to}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      setError('Failed to download PDF');
    }
  };

  const isFullYear = from.endsWith('-01-01') && to.endsWith('-12-31') && from.slice(0, 4) === to.slice(0, 4);
  const closeYear = from.slice(0, 4);

  const handleYearEndClose = async () => {
    setClosing(true);
    try {
      const res = await api.post(`/reports/year-end-close?year=${closeYear}`);
      setCloseResult(res.data);
      setCloseModalOpen(false);
      generate(); // Refresh report
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to close year');
      setCloseModalOpen(false);
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="page-container">
      <h1 className="page-title">Profit & Loss Statement</h1>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} onClose={() => setError('')} />}
      {closeResult && (
        <InlineNotification kind="success" style={{ marginBottom: '1rem' }} onClose={() => setCloseResult(null)}
          title={`Year ${closeYear} closed — Net Profit: ${fmt(closeResult.net_profit)}, Revenue closed: ${fmt(closeResult.revenue_closed)}, Expenses closed: ${fmt(closeResult.expenses_closed)}`} />
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <DatePicker datePickerType="single" value={new Date(from)} onChange={([d]) => d && setFrom(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="from" labelText="From" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <DatePicker datePickerType="single" value={new Date(to)} onChange={([d]) => d && setTo(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="to" labelText="To" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <Button onClick={generate} disabled={loading}>{loading ? 'Generating...' : 'Generate'}</Button>
        {report && (
          <>
            <Button kind="secondary" renderIcon={DocumentPdf} onClick={downloadPdf}>Download PDF</Button>
            <Button kind="ghost" renderIcon={Printer} onClick={() => window.print()}>Print</Button>
            {isFullYear && (
              <Button kind="danger--tertiary" renderIcon={Reset} onClick={() => setCloseModalOpen(true)}>Close Year {closeYear}</Button>
            )}
          </>
        )}
      </div>

      {loading && <InlineLoading description="Generating report..." />}

      {report && !loading && (
        <div id="pl-report">
          {/* Revenue */}
          <Tile style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f62fe', marginBottom: '0.75rem', borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Revenue</h3>
            {report.revenue.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f4f4f4' }}>
                <span style={{ color: '#525252' }}>{a.code} — {a.name}</span>
                <span>{fmt(a.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, borderTop: '1px solid #e0e0e0', marginTop: '0.5rem' }}>
              <span>Total Revenue</span><span>{fmt(report.totalRevenue)}</span>
            </div>
          </Tile>

          {/* COGS */}
          <Tile style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f62fe', marginBottom: '0.75rem', borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Cost of Goods Sold</h3>
            {report.cogs.length === 0 ? <p style={{ color: '#525252', padding: '0.35rem 0' }}>No COGS for this period</p> :
              report.cogs.map(a => (
                <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f4f4f4' }}>
                  <span style={{ color: '#525252' }}>{a.code} — {a.name}</span>
                  <span>{fmt(a.amount)}</span>
                </div>
              ))
            }
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, borderTop: '1px solid #e0e0e0', marginTop: '0.5rem' }}>
              <span>Total COGS</span><span>{fmt(report.totalCogs)}</span>
            </div>
          </Tile>

          {/* Gross Profit */}
          <Tile style={{ padding: '1rem 1.5rem', marginBottom: '1rem', background: '#edf5ff', borderLeft: '4px solid #0f62fe' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.1rem' }}>
              <span>Gross Profit</span><span style={{ color: '#0f62fe' }}>{fmt(report.grossProfit)}</span>
            </div>
          </Tile>

          {/* Operating Expenses */}
          <Tile style={{ padding: '1.5rem', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f62fe', marginBottom: '0.75rem', borderBottom: '2px solid #0f62fe', paddingBottom: '0.5rem' }}>Operating Expenses</h3>
            {report.operatingExpenses.map(a => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.35rem 0', borderBottom: '1px solid #f4f4f4' }}>
                <span style={{ color: '#525252' }}>{a.code} — {a.name} {a.borang_b_section ? `(${a.borang_b_section})` : ''}</span>
                <span>{fmt(a.amount)}</span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', fontWeight: 700, borderTop: '1px solid #e0e0e0', marginTop: '0.5rem' }}>
              <span>Total Operating Expenses</span><span>{fmt(report.totalOperatingExpenses)}</span>
            </div>
          </Tile>

          {/* Net Profit */}
          <Tile style={{ padding: '1rem 1.5rem', background: report.netProfit >= 0 ? '#defbe6' : '#fff1e6', borderLeft: `4px solid ${report.netProfit >= 0 ? '#0e6027' : '#da1e28'}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.25rem' }}>
              <span>Net {report.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
              <span style={{ color: report.netProfit >= 0 ? '#0e6027' : '#da1e28' }}>{fmt(report.netProfit)}</span>
            </div>
          </Tile>
        </div>
      )}

      <ComposedModal open={closeModalOpen} onClose={() => setCloseModalOpen(false)} size="sm">
        <ModalHeader title={`Close Year ${closeYear}`} />
        <ModalBody>
          <p>This will close all revenue and expense accounts for Assessment Year {closeYear} and transfer the net profit to Retained Earnings.</p>
          <p style={{ marginTop: '1rem', fontWeight: 600, color: '#da1e28' }}>This action cannot be undone.</p>
        </ModalBody>
        <ModalFooter
          danger
          primaryButtonText={closing ? 'Closing...' : 'Close Year'}
          secondaryButtonText="Cancel"
          onRequestSubmit={handleYearEndClose}
          onRequestClose={() => setCloseModalOpen(false)}
          primaryButtonDisabled={closing}
        />
      </ComposedModal>
    </div>
  );
}
