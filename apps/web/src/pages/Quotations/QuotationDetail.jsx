import React, { useState, useEffect } from 'react';
import {
  Tile,
  Button,
  Tag,
  InlineLoading,
  InlineNotification,
} from '@carbon/react';
import {
  ArrowLeft,
  Send,
  Checkmark,
  Close,
  Download,
  Edit,
  DocumentAdd,
} from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const STATUS_COLOR = {
  draft: 'gray', sent: 'blue', accepted: 'green',
  rejected: 'red', expired: 'magenta', converted: 'cyan',
};

export default function QuotationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [quotation, setQuotation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [notification, setNotification] = useState(null);

  const fetchQuotation = async () => {
    try {
      const res = await api.get(`/quotations/${id}`);
      setQuotation(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuotation(); }, [id]);

  const showNotif = (kind, msg) => {
    setNotification({ kind, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleAction = async (action, label) => {
    setActionLoading(action);
    try {
      await api.post(`/quotations/${id}/${action}`);
      showNotif('success', `Quotation ${label}`);
      fetchQuotation();
    } catch (err) {
      showNotif('error', err.response?.data?.error || `Failed to ${label.toLowerCase()}`);
    } finally {
      setActionLoading('');
    }
  };

  const handleConvert = async () => {
    if (!window.confirm('Convert this quotation to an invoice?')) return;
    setActionLoading('convert');
    try {
      const res = await api.post(`/quotations/${id}/convert-to-invoice`);
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to convert');
      setActionLoading('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this quotation? This cannot be undone.')) return;
    try {
      await api.delete(`/quotations/${id}`);
      navigate('/quotations');
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to delete');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/quotations/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${quotation?.quotation_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showNotif('error', 'Failed to download PDF');
    }
  };

  if (loading) return <InlineLoading description="Loading quotation..." />;
  if (!quotation) return <div>Quotation not found</div>;

  const subtotal = quotation.items?.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0) || 0;
  const tax = quotation.items?.reduce((s, i) => s + (parseFloat(i.tax_amount) || 0), 0) || 0;

  return (
    <div className="page-container">
      {notification && (
        <InlineNotification kind={notification.kind} title={notification.msg} style={{ marginBottom: '1rem' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/quotations')} style={{ marginBottom: '0.5rem' }}>
            Back to Quotations
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 300, margin: 0 }}>{quotation.quotation_number}</h1>
            <Tag type={STATUS_COLOR[quotation.status] || 'gray'} size="lg">{quotation.status?.toUpperCase()}</Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button kind="ghost" renderIcon={Download} onClick={handleDownloadPDF} size="sm">PDF</Button>
          {quotation.status === 'draft' && (
            <Button kind="ghost" renderIcon={Edit} onClick={() => navigate(`/quotations/${id}/edit`)} size="sm">Edit</Button>
          )}
          {quotation.status === 'draft' && (
            <Button renderIcon={Send} onClick={() => handleAction('send', 'sent')} size="sm"
              disabled={actionLoading === 'send'}>
              {actionLoading === 'send' ? 'Sending...' : 'Send'}
            </Button>
          )}
          {['draft', 'sent'].includes(quotation.status) && (
            <Button renderIcon={Checkmark} onClick={() => handleAction('accept', 'accepted')} size="sm" kind="primary"
              disabled={actionLoading === 'accept'}>
              {actionLoading === 'accept' ? 'Accepting...' : 'Accept'}
            </Button>
          )}
          {['draft', 'sent'].includes(quotation.status) && (
            <Button renderIcon={Close} onClick={() => handleAction('reject', 'rejected')} size="sm" kind="danger--ghost"
              disabled={actionLoading === 'reject'}>
              {actionLoading === 'reject' ? 'Rejecting...' : 'Reject'}
            </Button>
          )}
          {quotation.status === 'accepted' && (
            <Button renderIcon={DocumentAdd} onClick={handleConvert} size="sm" kind="primary"
              disabled={actionLoading === 'convert'}>
              {actionLoading === 'convert' ? 'Converting...' : 'Convert to Invoice'}
            </Button>
          )}
          {quotation.status === 'draft' && (
            <Button renderIcon={Close} onClick={handleDelete} size="sm" kind="danger--ghost">Delete</Button>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#525252' }}>Prepared For</h4>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{quotation.customer?.name}</div>
          <div style={{ color: '#525252', fontSize: '0.875rem', marginTop: '0.25rem' }}>{quotation.customer?.email}</div>
          <div style={{ color: '#525252', fontSize: '0.875rem' }}>{quotation.customer?.phone}</div>
        </Tile>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#525252' }}>Quotation Info</h4>
          {[
            ['Quotation #', quotation.quotation_number],
            ['Issue Date', quotation.issue_date],
            ['Valid Until', quotation.valid_until || '—'],
            ['Currency', quotation.currency || 'MYR'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '1rem', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#525252', width: 130, flexShrink: 0 }}>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </Tile>
      </div>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Line Items</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #e0e0e0', color: '#525252' }}>
              <th style={{ textAlign: 'left', padding: '0.5rem' }}>Description</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Qty</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Unit Price</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Tax</th>
              <th style={{ textAlign: 'right', padding: '0.5rem' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {quotation.items?.map((item, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                <td style={{ padding: '0.75rem 0.5rem' }}>{item.description}</td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{item.quantity}</td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>RM {Number(item.unit_price).toFixed(2)}</td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right' }}>{item.tax_rate || 0}%</td>
                <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', fontWeight: 600 }}>RM {(parseFloat(item.total) || 0).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', color: '#525252' }}>Subtotal</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>RM {subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', color: '#525252' }}>Tax</td>
              <td style={{ padding: '0.5rem', textAlign: 'right' }}>RM {tax.toFixed(2)}</td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>Total</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#0f62fe' }}>
                RM {(parseFloat(quotation.total) || 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Tile>

      {quotation.notes && (
        <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Notes</h3>
          <p style={{ color: '#525252', whiteSpace: 'pre-line' }}>{quotation.notes}</p>
        </Tile>
      )}

      <Tile style={{ padding: '1.5rem' }}>
        <AttachmentsPanel subjectType="quotation" subjectId={id} />
      </Tile>
    </div>
  );
}
