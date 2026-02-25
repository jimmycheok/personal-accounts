import React, { useState, useCallback } from 'react';
import {
  Tile,
  FileUploader,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Button,
  Tag,
  InlineLoading,
  InlineNotification,
  Select,
  SelectItem,
  ProgressBar,
} from '@carbon/react';
import { Upload, Checkmark, Warning } from '@carbon/icons-react';
import api from '../../services/api.js';

const HEADERS = [
  { key: 'date', header: 'Date' },
  { key: 'description', header: 'Description' },
  { key: 'debit', header: 'Debit' },
  { key: 'credit', header: 'Credit' },
  { key: 'balance', header: 'Balance' },
  { key: 'match', header: 'Match Status' },
  { key: 'matched_to', header: 'Matched To' },
];

const MATCH_COLOR = { matched: 'green', unmatched: 'red', partial: 'cyan', ignored: 'gray' };

export default function BankReconciliationPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState('');
  const [bankFormat, setBankFormat] = useState('maybank');
  const [reconciling, setReconciling] = useState(false);

  const handleFileChange = (e) => {
    const f = e.target?.files?.[0] || e[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a CSV file first'); return; }
    setUploading(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('statement', file);
      formData.append('bank_format', bankFormat);
      const res = await api.post('/bank-reconciliation/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to process bank statement');
    } finally {
      setUploading(false);
    }
  };

  const handleReconcile = async () => {
    if (!results?.id) return;
    setReconciling(true);
    try {
      const res = await api.post(`/bank-reconciliation/${results.id}/reconcile`);
      setResults(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const handleToggleIgnore = async (txId) => {
    try {
      await api.patch(`/bank-reconciliation/transactions/${txId}/ignore`);
      setResults(prev => ({
        ...prev,
        transactions: prev.transactions.map(tx =>
          tx.id === txId ? { ...tx, match_status: tx.match_status === 'ignored' ? 'unmatched' : 'ignored' } : tx
        ),
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const matched = results?.transactions?.filter(t => t.match_status === 'matched').length || 0;
  const total = results?.transactions?.length || 0;
  const progress = total > 0 ? Math.round((matched / total) * 100) : 0;

  const rows = (results?.transactions || []).map(tx => ({
    id: String(tx.id),
    date: tx.date,
    description: tx.description || tx.narration || '-',
    debit: tx.debit ? `RM ${Number(tx.debit).toFixed(2)}` : '-',
    credit: tx.credit ? `RM ${Number(tx.credit).toFixed(2)}` : '-',
    balance: tx.balance ? `RM ${Number(tx.balance).toFixed(2)}` : '-',
    match: tx.match_status || 'unmatched',
    matched_to: tx.matched_record?.description || tx.matched_record?.invoice_number || '-',
    _txId: tx.id,
  }));

  return (
    <div className="page-container">
      <h1 className="page-title">Bank Reconciliation</h1>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Upload Bank Statement</h3>
        <div className="grid-2" style={{ alignItems: 'end', marginBottom: '1rem' }}>
          <Select id="bank-format" labelText="Bank / Statement Format" value={bankFormat}
            onChange={e => setBankFormat(e.target.value)}>
            <SelectItem value="maybank" text="Maybank (CSV)" />
            <SelectItem value="cimb" text="CIMB Clicks (CSV)" />
            <SelectItem value="rhb" text="RHB (CSV)" />
            <SelectItem value="public_bank" text="Public Bank (CSV)" />
            <SelectItem value="hong_leong" text="Hong Leong Bank (CSV)" />
            <SelectItem value="generic" text="Generic CSV (Date, Desc, Debit, Credit)" />
          </Select>
          <Button renderIcon={Upload} onClick={handleUpload} disabled={uploading || !file}>
            {uploading ? 'Processing...' : 'Upload & Parse'}
          </Button>
        </div>
        <FileUploader
          labelTitle=""
          labelDescription="Upload CSV bank statement export"
          buttonLabel="Select CSV File"
          accept={['.csv', '.txt']}
          size="md"
          onChange={handleFileChange}
        />
        {file && <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#525252' }}>Selected: {file.name}</p>}
      </Tile>

      {results && (
        <>
          <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontWeight: 600, margin: 0 }}>Reconciliation Summary</h3>
                <p style={{ color: '#525252', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                  {matched} of {total} transactions matched ({progress}%)
                </p>
              </div>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <Tag type="green">{matched} Matched</Tag>
                <Tag type="red">{results.transactions?.filter(t => t.match_status === 'unmatched').length || 0} Unmatched</Tag>
                <Button renderIcon={Checkmark} onClick={handleReconcile} disabled={reconciling}>
                  {reconciling ? 'Reconciling...' : 'Auto-Reconcile'}
                </Button>
              </div>
            </div>
            <ProgressBar
              value={progress}
              max={100}
              label={`${progress}% matched`}
              helperText={`${matched}/${total} transactions reconciled`}
            />
          </Tile>

          <DataTable rows={rows} headers={HEADERS}>
            {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer title="Bank Transactions">
                <Table {...getTableProps()} size="sm">
                  <TableHead>
                    <TableRow>
                      {headers.map(h => <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>)}
                      <TableHeader>Actions</TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map(row => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map(cell => (
                          <TableCell key={cell.id}>
                            {cell.info.header === 'match'
                              ? <Tag type={MATCH_COLOR[cell.value] || 'gray'}>{cell.value}</Tag>
                              : cell.value}
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button kind="ghost" size="sm"
                            onClick={() => handleToggleIgnore(row.cells.find(c => c.info.header === 'match')?.id)}>
                            Ignore
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </>
      )}

      {!results && (
        <Tile style={{ padding: '3rem', textAlign: 'center', color: '#525252' }}>
          <Warning size={48} style={{ marginBottom: '1rem', color: '#8d8d8d' }} />
          <h3 style={{ fontWeight: 400 }}>No bank statement uploaded yet</h3>
          <p style={{ fontSize: '0.875rem' }}>Upload a CSV export from your bank to start reconciling transactions with your records.</p>
        </Tile>
      )}
    </div>
  );
}
