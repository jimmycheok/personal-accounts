import React, { useState, useEffect } from 'react';
import {
  Tile,
  Button,
  DatePicker,
  DatePickerInput,
  InlineLoading,
  Tag,
} from '@carbon/react';
import { ArrowLeft } from '@carbon/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../../services/api.js';

const TYPE_COLORS = { asset: 'green', liability: 'red', equity: 'blue', revenue: 'purple', expense: 'orange' };

export default function AccountLedgerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);

  const loadLedger = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/accounts/${id}/ledger`, { params: { from, to } });
      setAccount(res.data.account);
      setLedger(res.data.ledger);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLedger(); }, [id, from, to]);

  if (loading && !account) return <InlineLoading description="Loading ledger..." />;

  return (
    <div className="page-container">
      <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/chart-of-accounts')} style={{ marginBottom: '1rem' }}>
        Back to Chart of Accounts
      </Button>

      {account && (
        <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 className="page-title" style={{ margin: 0 }}>{account.code} — {account.name}</h1>
              <p style={{ color: '#525252', marginTop: '0.25rem' }}>{account.description || ''}</p>
            </div>
            <Tag type={TYPE_COLORS[account.account_type]} size="md">{account.account_type}</Tag>
          </div>
        </Tile>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end' }}>
        <DatePicker datePickerType="single" value={new Date(from)} onChange={([d]) => d && setFrom(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="from" labelText="From" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <DatePicker datePickerType="single" value={new Date(to)} onChange={([d]) => d && setTo(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="to" labelText="To" placeholder="YYYY-MM-DD" />
        </DatePicker>
      </div>

      <Tile style={{ padding: '1.5rem' }}>
        {loading ? <InlineLoading description="Loading..." /> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Date</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Reference</th>
                  <th style={{ textAlign: 'left', padding: '0.5rem' }}>Description</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Debit</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Credit</th>
                  <th style={{ textAlign: 'right', padding: '0.5rem' }}>Balance</th>
                </tr>
              </thead>
              <tbody>
                {ledger.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '2rem', textAlign: 'center', color: '#525252' }}>No transactions for this period</td></tr>
                ) : ledger.map((line, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0', cursor: 'pointer' }}
                    onClick={() => navigate(`/general-ledger/${line.journal_entry_id}`)}>
                    <td style={{ padding: '0.5rem' }}>{line.entry_date}</td>
                    <td style={{ padding: '0.5rem', color: '#0f62fe' }}>{line.reference_number}</td>
                    <td style={{ padding: '0.5rem' }}>{line.description}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{line.debit > 0 ? `RM ${line.debit.toFixed(2)}` : ''}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right' }}>{line.credit > 0 ? `RM ${line.credit.toFixed(2)}` : ''}</td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>RM {line.balance.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              {ledger.length > 0 && (
                <tfoot>
                  <tr style={{ borderTop: '2px solid #e0e0e0' }}>
                    <td colSpan={3} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>Closing Balance</td>
                    <td></td><td></td>
                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: '#0f62fe' }}>
                      RM {ledger[ledger.length - 1].balance.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </Tile>
    </div>
  );
}
