import React, { useState, useEffect } from 'react';
import {
  Tile,
  Button,
  Tag,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const SOURCE_COLORS = { invoice: 'blue', payment: 'green', expense: 'orange', credit_note: 'red', manual: 'purple', year_end_close: 'cyan' };

export default function JournalEntryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [entry, setEntry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get(`/journal-entries/${id}`)
      .then(res => setEntry(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handlePost = async () => {
    setPosting(true);
    setError('');
    try {
      await api.post(`/journal-entries/${id}/post`);
      const res = await api.get(`/journal-entries/${id}`);
      setEntry(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to post entry');
    } finally {
      setPosting(false);
    }
  };

  if (loading) return <InlineLoading description="Loading journal entry..." />;
  if (!entry) return <div>Journal entry not found</div>;

  const totalDebit = (entry.lines || []).reduce((s, l) => s + parseFloat(l.debit), 0);
  const totalCredit = (entry.lines || []).reduce((s, l) => s + parseFloat(l.credit), 0);

  return (
    <div className="page-container">
      <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/general-ledger')} style={{ marginBottom: '1rem' }}>
        Back to General Ledger
      </Button>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{entry.reference_number}</h1>
            <p style={{ color: '#525252', marginTop: '0.5rem' }}>{entry.description}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <Tag type={entry.status === 'posted' ? 'green' : 'gray'} size="md">{entry.status.charAt(0).toUpperCase() + entry.status.slice(1)}</Tag>
            <Tag type={SOURCE_COLORS[entry.source_type] || 'gray'} size="md">{(entry.source_type || 'manual').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Tag>
          </div>
        </div>
        <div className="grid-3" style={{ marginTop: '1rem' }}>
          <div><strong>Entry Date:</strong> {entry.entry_date}</div>
          <div><strong>Auto-generated:</strong> {entry.is_auto ? 'Yes' : 'No'}</div>
          <div><strong>Posted:</strong> {entry.posted_at ? new Date(entry.posted_at).toLocaleString() : '—'}</div>
        </div>
        {entry.status === 'draft' && !entry.is_auto && (
          <Button onClick={handlePost} disabled={posting} style={{ marginTop: '1rem' }}>
            {posting ? 'Posting...' : 'Post Entry'}
          </Button>
        )}
      </Tile>

      <Tile style={{ padding: '1.5rem' }}>
        <h3 className="form-section-title">Journal Lines</h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', width: '10%' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', width: '30%' }}>Account</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', width: '25%' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '15%' }}>Debit</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '15%' }}>Credit</th>
              </tr>
            </thead>
            <tbody>
              {(entry.lines || []).map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.5rem', color: '#0f62fe' }}>{line.account?.code}</td>
                  <td style={{ padding: '0.5rem' }}>{line.account?.name}</td>
                  <td style={{ padding: '0.5rem', color: '#525252' }}>{line.description || ''}</td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                    {parseFloat(line.debit) > 0 ? `RM ${parseFloat(line.debit).toFixed(2)}` : ''}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                    {parseFloat(line.credit) > 0 ? `RM ${parseFloat(line.credit).toFixed(2)}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e0e0e0' }}>
                <td colSpan={3} style={{ padding: '0.5rem', fontWeight: 700, textAlign: 'right' }}>Totals</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>RM {totalDebit.toFixed(2)}</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>RM {totalCredit.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Tile>
    </div>
  );
}
