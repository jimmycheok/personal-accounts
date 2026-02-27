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
  Close,
  Download,
  Upload,
} from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const STATUS_COLOR = {
  draft: 'gray', submitted: 'blue', applied: 'green', cancelled: 'magenta',
};

const REASON_LABEL = {
  returned_goods: 'Returned Goods',
  overcharge: 'Overcharge / Billing Error',
  discount: 'Discount Applied',
  service_not_rendered: 'Service Not Rendered',
  other: 'Other',
};

export default function CreditNoteDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [creditNote, setCreditNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [notification, setNotification] = useState(null);

  const fetchCreditNote = async () => {
    try {
      const res = await api.get(`/credit-notes/${id}`);
      setCreditNote(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCreditNote(); }, [id]);

  const showNotif = (kind, msg) => {
    setNotification({ kind, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSend = async () => {
    setActionLoading('send');
    try {
      await api.post(`/credit-notes/${id}/send`);
      showNotif('success', 'Credit note submitted');
      fetchCreditNote();
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to send');
    } finally {
      setActionLoading('');
    }
  };

  const handleVoid = async () => {
    if (!window.confirm('Void this credit note? This cannot be undone.')) return;
    setActionLoading('void');
    try {
      await api.post(`/credit-notes/${id}/void`);
      showNotif('success', 'Credit note voided');
      fetchCreditNote();
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to void');
    } finally {
      setActionLoading('');
    }
  };

  const handleSubmitEInvoice = async () => {
    setActionLoading('einvoice');
    try {
      await api.post(`/credit-notes/${id}/submit-einvoice`);
      showNotif('success', 'E-Invoice submitted to MyInvois');
      fetchCreditNote();
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to submit e-invoice');
    } finally {
      setActionLoading('');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/credit-notes/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${creditNote?.credit_note_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch {
      showNotif('error', 'Failed to download PDF');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this credit note? This cannot be undone.')) return;
    try {
      await api.delete(`/credit-notes/${id}`);
      navigate('/credit-notes');
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to delete');
    }
  };

  if (loading) return <InlineLoading description="Loading credit note..." />;
  if (!creditNote) return <div>Credit note not found</div>;

  return (
    <div className="page-container">
      {notification && (
        <InlineNotification kind={notification.kind} title={notification.msg} style={{ marginBottom: '1rem' }} />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/credit-notes')} style={{ marginBottom: '0.5rem' }}>
            Back to Credit Notes
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 300, margin: 0 }}>{creditNote.credit_note_number}</h1>
            <Tag type={STATUS_COLOR[creditNote.status] || 'gray'} size="lg">{creditNote.status?.toUpperCase()}</Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button kind="ghost" renderIcon={Download} onClick={handleDownloadPDF} size="sm">PDF</Button>
          {creditNote.status === 'draft' && (
            <Button renderIcon={Send} onClick={handleSend} size="sm"
              disabled={actionLoading === 'send'}>
              {actionLoading === 'send' ? 'Sending...' : 'Send'}
            </Button>
          )}
          {creditNote.status === 'submitted' && (
            <Button renderIcon={Upload} onClick={handleSubmitEInvoice} size="sm" kind="tertiary"
              disabled={actionLoading === 'einvoice'}>
              {actionLoading === 'einvoice' ? 'Submitting...' : 'Submit e-Invoice'}
            </Button>
          )}
          {creditNote.status !== 'cancelled' && (
            <Button renderIcon={Close} onClick={handleVoid} size="sm" kind="danger--ghost"
              disabled={actionLoading === 'void'}>
              Void
            </Button>
          )}
          {creditNote.status === 'draft' && (
            <Button renderIcon={Close} onClick={handleDelete} size="sm" kind="danger--ghost">Delete</Button>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#525252' }}>Customer</h4>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>
            {creditNote.invoice?.customer?.name || '—'}
          </div>
          <div style={{ color: '#525252', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            {creditNote.invoice?.customer?.email || '—'}
          </div>
        </Tile>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#525252' }}>Credit Note Info</h4>
          {[
            ['Credit Note #', creditNote.credit_note_number],
            ['Issue Date', creditNote.issue_date],
            ['Related Invoice', creditNote.invoice?.invoice_number || '—'],
            ['Reason', REASON_LABEL[creditNote.reason] || creditNote.reason || '—'],
          ].map(([label, value]) => (
            <div key={label} style={{ display: 'flex', gap: '1rem', marginBottom: '0.25rem', fontSize: '0.875rem' }}>
              <span style={{ color: '#525252', width: 130, flexShrink: 0 }}>{label}</span>
              <span>{value}</span>
            </div>
          ))}
        </Tile>
      </div>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Amount Summary</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', maxWidth: 400 }}>
          <tbody>
            {creditNote.tax_amount > 0 && (
              <>
                <tr>
                  <td style={{ padding: '0.4rem 0', color: '#525252' }}>Subtotal</td>
                  <td style={{ padding: '0.4rem 0', textAlign: 'right' }}>
                    RM {(parseFloat(creditNote.amount) - parseFloat(creditNote.tax_amount || 0)).toFixed(2)}
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '0.4rem 0', color: '#525252' }}>Tax</td>
                  <td style={{ padding: '0.4rem 0', textAlign: 'right' }}>
                    RM {parseFloat(creditNote.tax_amount || 0).toFixed(2)}
                  </td>
                </tr>
              </>
            )}
            <tr style={{ borderTop: '2px solid #e0e0e0' }}>
              <td style={{ padding: '0.5rem 0', fontWeight: 700, fontSize: '1rem' }}>Credit Amount</td>
              <td style={{ padding: '0.5rem 0', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#0f62fe' }}>
                RM {parseFloat(creditNote.amount || 0).toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </Tile>

      {creditNote.notes && (
        <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Notes</h3>
          <p style={{ color: '#525252', whiteSpace: 'pre-line' }}>{creditNote.notes}</p>
        </Tile>
      )}

      <Tile style={{ padding: '1.5rem' }}>
        <AttachmentsPanel subjectType="credit_note" subjectId={id} />
      </Tile>
    </div>
  );
}
