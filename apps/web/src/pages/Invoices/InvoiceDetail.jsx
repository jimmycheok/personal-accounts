import React, { useState, useEffect } from 'react';
import {
  Tile,
  Button,
  Tag,
  InlineLoading,
  InlineNotification,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
} from '@carbon/react';
import {
  Send,
  Checkmark,
  Close,
  Download,
  Upload,
  ArrowLeft,
} from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import PaymentModal from '../../components/PaymentModal.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const STATUS_COLOR = {
  draft: 'gray', sent: 'blue', paid: 'green', overdue: 'red', void: 'magenta', partial: 'cyan',
};

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [notification, setNotification] = useState(null);

  const fetchInvoice = async () => {
    try {
      const res = await api.get(`/invoices/${id}`);
      setInvoice(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoice(); }, [id]);

  const showNotif = (kind, msg) => {
    setNotification({ kind, msg });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleSend = async () => {
    setActionLoading('send');
    try {
      await api.post(`/invoices/${id}/send`);
      showNotif('success', 'Invoice sent successfully');
      fetchInvoice();
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to send');
    } finally {
      setActionLoading('');
    }
  };

  const handleVoid = async () => {
    if (!window.confirm('Void this invoice? This cannot be undone.')) return;
    setActionLoading('void');
    try {
      await api.patch(`/invoices/${id}/void`);
      showNotif('success', 'Invoice voided');
      fetchInvoice();
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to void');
    } finally {
      setActionLoading('');
    }
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await api.get(`/invoices/${id}/pdf`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice?.invoice_number}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      showNotif('error', 'Failed to download PDF');
    }
  };

  const handleSubmitEInvoice = async () => {
    setActionLoading('einvoice');
    try {
      await api.post(`/invoices/${id}/submit-einvoice`);
      showNotif('success', 'E-Invoice submitted to MyInvois');
      fetchInvoice();
    } catch (err) {
      showNotif('error', err.response?.data?.error || 'Failed to submit e-invoice');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <InlineLoading description="Loading invoice..." />;
  if (!invoice) return <div>Invoice not found</div>;

  const subtotal = invoice.items?.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0) || 0;
  const tax = invoice.items?.reduce((s, i) => s + (parseFloat(i.tax_amount) || 0), 0) || 0;

  return (
    <div className="page-container">
      {notification && (
        <InlineNotification
          kind={notification.kind}
          title={notification.msg}
          style={{ marginBottom: '1rem' }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <Button kind="ghost" renderIcon={ArrowLeft} onClick={() => navigate('/invoices')} style={{ marginBottom: '0.5rem' }}>
            Back to Invoices
          </Button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 300, margin: 0 }}>{invoice.invoice_number}</h1>
            <Tag type={STATUS_COLOR[invoice.status] || 'gray'} size="lg">{invoice.status?.toUpperCase()}</Tag>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <Button kind="ghost" renderIcon={Download} onClick={handleDownloadPDF} size="sm">PDF</Button>
          {invoice.status === 'draft' && (
            <Button renderIcon={Send} onClick={handleSend} size="sm" disabled={actionLoading === 'send'}>
              {actionLoading === 'send' ? 'Sending...' : 'Send'}
            </Button>
          )}
          {['sent', 'partial', 'overdue'].includes(invoice.status) && (
            <Button renderIcon={Checkmark} onClick={() => setPaymentModalOpen(true)} size="sm" kind="primary">
              Record Payment
            </Button>
          )}
          {['sent', 'partial', 'overdue'].includes(invoice.status) && (
            <Button renderIcon={Upload} onClick={handleSubmitEInvoice} size="sm" kind="tertiary"
              disabled={actionLoading === 'einvoice'}>
              {actionLoading === 'einvoice' ? 'Submitting...' : 'Submit e-Invoice'}
            </Button>
          )}
          {invoice.status !== 'void' && (
            <Button renderIcon={Close} onClick={handleVoid} size="sm" kind="danger--ghost"
              disabled={actionLoading === 'void'}>
              Void
            </Button>
          )}
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#525252' }}>Bill To</h4>
          <div style={{ fontWeight: 600, fontSize: '1rem' }}>{invoice.customer?.name}</div>
          <div style={{ color: '#525252', fontSize: '0.875rem', marginTop: '0.25rem' }}>{invoice.customer?.email}</div>
          <div style={{ color: '#525252', fontSize: '0.875rem' }}>{invoice.customer?.phone}</div>
          <div style={{ color: '#525252', fontSize: '0.875rem', marginTop: '0.25rem', whiteSpace: 'pre-line' }}>{invoice.customer?.address}</div>
        </Tile>
        <Tile style={{ padding: '1.5rem' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#525252' }}>Invoice Info</h4>
          {[
            ['Issue Date', invoice.issue_date],
            ['Due Date', invoice.due_date],
            ['Currency', invoice.currency || 'MYR'],
            ['PO Number', invoice.po_number || '—'],
            ['E-Invoice UUID', invoice.einvoice_uuid || '—'],
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
            {invoice.items?.map((item, idx) => (
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
                RM {(parseFloat(invoice.total) || 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', color: '#525252' }}>Amount Paid</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', color: '#0e6027' }}>
                RM {(parseFloat(invoice.amount_paid) || 0).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700 }}>Balance Due</td>
              <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, color: '#da1e28' }}>
                RM {(parseFloat(invoice.amount_due) || 0).toFixed(2)}
              </td>
            </tr>
          </tfoot>
        </table>
      </Tile>

      {invoice.payments?.length > 0 && (
        <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Payment History</h3>
          <DataTable rows={invoice.payments.map(p => ({
            id: String(p.id),
            date: p.payment_date,
            method: p.payment_method,
            reference: p.reference || '—',
            amount: `RM ${Number(p.amount).toFixed(2)}`,
          }))} headers={[
            { key: 'date', header: 'Date' },
            { key: 'method', header: 'Method' },
            { key: 'reference', header: 'Reference' },
            { key: 'amount', header: 'Amount' },
          ]}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()} size="sm">
                  <TableHead>
                    <TableRow>
                      {headers.map(h => <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map(cell => <TableCell key={cell.id}>{cell.value}</TableCell>)}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </Tile>
      )}

      {invoice.notes && (
        <Tile style={{ padding: '1.5rem' }}>
          <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Notes</h3>
          <p style={{ color: '#525252', whiteSpace: 'pre-line' }}>{invoice.notes}</p>
        </Tile>
      )}

      <Tile style={{ padding: '1.5rem', marginTop: '1.5rem' }}>
        <AttachmentsPanel subjectType="invoice" subjectId={id} />
      </Tile>

      <PaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        invoiceId={id}
        amountDue={invoice.amount_due}
        onSuccess={fetchInvoice}
      />
    </div>
  );
}
