import React, { useState, useEffect } from 'react';
import {
  Button, Tag, InlineNotification, StructuredListWrapper, StructuredListHead,
  StructuredListRow, StructuredListCell, StructuredListBody,
} from '@carbon/react';
import { Checkmark, Document as DocumentIcon, Close, Edit } from '@carbon/icons-react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import GLReviewModal from '../../components/GLReviewModal.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const STATUS_TAG = { draft: 'gray', approved: 'green', voided: 'red' };
const BANK_CODE = '1010';
const CASH_CODE = '1000';

export default function PaymentVoucherDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [voucher, setVoucher] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [showGL, setShowGL] = useState(false);

  const load = () => {
    api.get(`/payment-vouchers/${id}`)
      .then(res => setVoucher(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load voucher'));
  };
  useEffect(() => { load(); }, [id]);
  useEffect(() => { api.get('/accounts').then(res => setAccounts(res.data || [])).catch(console.error); }, []);

  // Build the debit lines (one per PV line) + the credit (bank/cash) line for the GL modal
  const buildInitialLines = () => {
    if (!voucher) return [];
    const debitLines = (voucher.lines || []).map(l => ({
      account_id: l.account_id,
      account_code: l.account?.code || '',
      account_name: l.account?.name || '',
      debit: Number(l.amount) || 0,
      credit: 0,
      description: l.description || '',
    }));
    const payCode = voucher.payment_method === 'cash' ? CASH_CODE : BANK_CODE;
    const payAcct = accounts.find(a => a.code === payCode);
    return [
      ...debitLines,
      {
        account_id: payAcct?.id || '',
        account_code: payAcct?.code || payCode,
        account_name: payAcct?.name || '',
        debit: 0,
        credit: Number(voucher.total_amount) || 0,
        description: `Payment via ${voucher.payment_method}`,
      },
    ];
  };

  const handleApprove = async (journalLines) => {
    setShowGL(false);
    if (!journalLines?.length) { setError('A balanced GL entry is required to approve this voucher.'); return; } // "Skip GL" not allowed for approval
    try {
      await api.post(`/payment-vouchers/${id}/approve`, { journal_lines: journalLines });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Approval failed');
    }
  };

  const handleVoid = async () => {
    try { await api.post(`/payment-vouchers/${id}/void`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Void failed'); }
  };

  const openPdf = () => window.open(`${api.defaults.baseURL}/payment-vouchers/${id}/pdf`, '_blank');

  if (!voucher) {
    return <div>{error ? <InlineNotification kind="error" title={error} /> : 'Loading...'}</div>;
  }

  const field = (label, value) => (
    <div><div style={{ fontSize: '0.75rem', color: '#6f6f6f' }}>{label}</div><div>{value || '—'}</div></div>
  );

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400 }}>{voucher.pv_number || 'Payment Voucher (Draft)'}</h1>
          <Tag type={STATUS_TAG[voucher.status] || 'gray'}>{voucher.status}</Tag>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {voucher.status === 'draft' && <Button kind="secondary" renderIcon={Edit} onClick={() => navigate(`/payment-vouchers/${id}/edit`)}>Edit</Button>}
          {voucher.status === 'draft' && <Button renderIcon={Checkmark} onClick={() => setShowGL(true)}>Approve &amp; Post GL</Button>}
          {voucher.status === 'approved' && <Button kind="secondary" renderIcon={DocumentIcon} onClick={openPdf}>PDF</Button>}
          {voucher.status === 'approved' && <Button kind="danger--tertiary" renderIcon={Close} onClick={handleVoid}>Void</Button>}
        </div>
      </div>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1.5rem', border: '1px solid #e0e0e0' }}>
        {field('Date', voucher.pv_date)}
        {field('Payee', voucher.payee_name)}
        {field('Method', voucher.payment_method)}
        {field('Reference', voucher.payment_reference)}
        {field('Bank', voucher.payee_bank_name)}
        {field('Bank Account', voucher.payee_bank_account)}
        {field('TIN', voucher.payee_tin)}
        {field('Total', `RM ${Number(voucher.total_amount || 0).toFixed(2)}`)}
      </div>

      <StructuredListWrapper style={{ background: '#fff' }}>
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>Description</StructuredListCell>
            <StructuredListCell head>Account</StructuredListCell>
            <StructuredListCell head style={{ textAlign: 'right' }}>Amount (RM)</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          {(voucher.lines || []).map(l => (
            <StructuredListRow key={l.id}>
              <StructuredListCell>{l.description || '—'}</StructuredListCell>
              <StructuredListCell>{l.account ? `${l.account.code} — ${l.account.name}` : ''}</StructuredListCell>
              <StructuredListCell style={{ textAlign: 'right' }}>{Number(l.amount || 0).toFixed(2)}</StructuredListCell>
            </StructuredListRow>
          ))}
        </StructuredListBody>
      </StructuredListWrapper>

      {voucher.journalEntry && (
        <div style={{ marginTop: '1rem', fontSize: '0.875rem', color: '#6f6f6f' }}>
          Posted to GL: <strong>{voucher.journalEntry.reference_number}</strong>
        </div>
      )}

      <div style={{ marginTop: '2rem' }}>
        <AttachmentsPanel subjectType="payment_voucher" subjectId={voucher.id} />
      </div>

      <GLReviewModal
        open={showGL}
        type="payment_voucher_approve"
        data={{ amount: voucher.total_amount, payee_name: voucher.payee_name, method: voucher.payment_method }}
        initialLines={buildInitialLines()}
        onAccept={handleApprove}
        onCancel={() => setShowGL(false)}
      />
    </div>
  );
}
