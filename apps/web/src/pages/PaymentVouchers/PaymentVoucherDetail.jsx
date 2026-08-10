import React, { useState, useEffect } from 'react';
import {
  Button, Tag, InlineNotification, StructuredListWrapper, StructuredListHead,
  StructuredListRow, StructuredListCell, StructuredListBody,
} from '@carbon/react';
import { Document as DocumentIcon, Close } from '@carbon/icons-react';
import { useParams } from 'react-router-dom';
import api from '../../services/api.js';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const STATUS_TAG = { draft: 'gray', approved: 'green', voided: 'red' };
const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function PaymentVoucherDetail() {
  const { id } = useParams();
  const [voucher, setVoucher] = useState(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get(`/payment-vouchers/${id}`)
      .then(res => setVoucher(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load voucher'));
  };
  useEffect(() => { load(); }, [id]);

  const handleVoid = async () => {
    try { await api.post(`/payment-vouchers/${id}/void`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Void failed'); }
  };

  // Fetch through axios so the request interceptor attaches the JWT. A plain
  // window.open() on the API URL is a raw browser navigation that skips the
  // interceptor entirely, so the server sees no Authorization header and
  // returns {"error":"No token provided"}.
  const downloadPdf = async () => {
    try {
      const res = await api.get(`/payment-vouchers/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${voucher.pv_number || 'payment-voucher'}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to download voucher PDF');
    }
  };

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
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400 }}>{voucher.pv_number || 'Payment Voucher'}</h1>
          <Tag type={STATUS_TAG[voucher.status] || 'gray'}>{titleCase(voucher.status)}</Tag>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {voucher.status === 'approved' && <Button kind="secondary" renderIcon={DocumentIcon} onClick={downloadPdf}>PDF</Button>}
          {voucher.status === 'approved' && <Button kind="danger--tertiary" renderIcon={Close} onClick={handleVoid}>Void</Button>}
        </div>
      </div>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem', background: '#fff', padding: '1.5rem', border: '1px solid #e0e0e0' }}>
        {field('Date', voucher.pv_date)}
        {field('Payee', voucher.payee_name)}
        {field('Method', titleCase(voucher.payment_method))}
        {field('Reference', voucher.payment_reference)}
        {field('Bank', voucher.payee_bank_name)}
        {field('Bank Account', voucher.payee_bank_account)}
        {field('TIN', voucher.payee_tin)}
        {field('Total', `RM ${Number(voucher.total_amount || 0).toFixed(2)}`)}
      </div>

      <StructuredListWrapper style={{ background: '#fff' }}>
        <StructuredListHead>
          <StructuredListRow head>
            <StructuredListCell head>Service Item</StructuredListCell>
            <StructuredListCell head style={{ textAlign: 'right' }}>Amount (RM)</StructuredListCell>
          </StructuredListRow>
        </StructuredListHead>
        <StructuredListBody>
          {(voucher.lines || []).map(l => (
            <StructuredListRow key={l.id}>
              <StructuredListCell>{l.service_item || '—'}</StructuredListCell>
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
    </div>
  );
}
