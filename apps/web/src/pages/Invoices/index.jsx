import React, { useState, useEffect } from 'react';
import {
  DataTable,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableSelectAll,
  TableSelectRow,
  Button,
  Tag,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  Pagination,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import PaymentModal from '../../components/PaymentModal.jsx';
import ConfirmModal from '../../components/ConfirmModal.jsx';

const STATUS_COLOR = {
  draft: 'gray',
  sent: 'blue',
  paid: 'green',
  overdue: 'red',
  void: 'magenta',
  partial: 'cyan',
};

const HEADERS = [
  { key: 'invoice_number', header: 'Invoice #' },
  { key: 'customer', header: 'Customer' },
  { key: 'issue_date', header: 'Issue Date' },
  { key: 'due_date', header: 'Due Date' },
  { key: 'total_amount', header: 'Total' },
  { key: 'amount_due', header: 'Balance' },
  { key: 'status', header: 'Status' },
  { key: 'actions', header: '' },
];

export default function InvoicesListPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [paymentModal, setPaymentModal] = useState({ open: false, invoiceId: null, amountDue: 0 });
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null });

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', {
        params: { search, page, limit: pageSize },
      });
      setInvoices(res.data.invoices || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchInvoices(); }, [page, pageSize]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleVoid = async (id) => {
    setConfirmModal({ open: true, id });
  };

  const confirmVoid = async () => {
    const id = confirmModal.id;
    setConfirmModal({ open: false, id: null });
    try {
      await api.patch(`/invoices/${id}/void`);
      fetchInvoices();
    } catch (err) {
      console.error(err.response?.data?.error || 'Failed to void invoice');
    }
  };

  const handleDuplicate = async (id) => {
    try {
      const res = await api.get(`/invoices/${id}`);
      const inv = res.data;
      navigate('/invoices/new', {
        state: {
          duplicate: {
            customer_id: inv.customer_id,
            payment_terms: inv.payment_terms || 30,
            notes: inv.notes || '',
            currency: inv.currency || 'MYR',
            po_number: '',
            items: inv.items?.map(item => ({
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate || 0,
              amount: item.amount,
            })) || [],
          },
        },
      });
    } catch (err) {
      console.error('Failed to load invoice for duplication');
    }
  };

  const handleMarkPaid = (id) => {
    const invoice = invoices.find(inv => String(inv.id) === String(id));
    setPaymentModal({ open: true, invoiceId: id, invoiceNumber: invoice?.invoice_number || '', amountDue: invoice?.amount_due ?? 0 });
  };

  const rows = invoices
    .filter(inv => !search || inv.invoice_number?.toLowerCase().includes(search.toLowerCase())
      || inv.customer?.name?.toLowerCase().includes(search.toLowerCase()))
    .map(inv => ({
      id: String(inv.id),
      invoice_number: inv.invoice_number,
      customer: inv.customer?.name || '-',
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      total_amount: `RM ${(parseFloat(inv.total) || 0).toFixed(2)}`,
      amount_due: `RM ${(parseFloat(inv.amount_due) || 0).toFixed(2)}`,
      status: inv.status,
    }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Invoices</h1>
        <Button renderIcon={Add} onClick={() => navigate('/invoices/new')}>New Invoice</Button>
      </div>

      {loading ? <InlineLoading description="Loading invoices..." /> : (
        <>
          <DataTable rows={rows} headers={HEADERS} isSortable>
            {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getSelectionProps, getToolbarProps }) => (
              <TableContainer>
                <TableToolbar {...getToolbarProps()}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      value={search}
                      onChange={handleSearch}
                      placeholder="Search invoices..."
                    />
                  </TableToolbarContent>
                </TableToolbar>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map(h => (
                        <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map(row => {
                      const invoice = invoices.find(inv => String(inv.id) === row.id);

                      return (
                        <TableRow {...getRowProps({ row })} key={row.id} style={{ cursor: 'pointer' }}>
                          {row.cells.map(cell => (
                            <TableCell key={cell.id}
                              onClick={cell.info.header !== 'actions' ? () => navigate(`/invoices/${row.id}`) : undefined}
                            >
                              {cell.info.header === 'status' ? (
                                <Tag type={STATUS_COLOR[cell.value] || 'gray'}>{cell.value.toUpperCase()}</Tag>
                              ) : cell.info.header === 'actions' ? (
                                <OverflowMenu flipped size="sm">
                                  <OverflowMenuItem itemText="View" onClick={() => navigate(`/invoices/${row.id}`)} />
                                  {invoice?.status !== 'paid' && invoice?.amount_paid == 0 && (
                                    <OverflowMenuItem itemText="Edit" onClick={() => navigate(`/invoices/${row.id}/edit`)} />
                                  )}
                                  {invoice?.status !== 'paid' && (
                                    <OverflowMenuItem itemText="Mark Paid" onClick={() => handleMarkPaid(row.id)} />
                                  )}
                                  <OverflowMenuItem itemText="Duplicate" onClick={() => handleDuplicate(row.id)} />
                                  <OverflowMenuItem itemText="Void" hasDivider isDelete onClick={() => handleVoid(row.id)} />
                                </OverflowMenu>
                              ) : cell.value}
                            </TableCell>
                          ))}
                        </TableRow>
                      )
                    })}
                    {tableRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={HEADERS.length}>
                          <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                            No invoices found. <button style={{ background: 'none', border: 'none', color: '#0f62fe', cursor: 'pointer' }} onClick={() => navigate('/invoices/new')}>Create your first invoice</button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
          <Pagination
            totalItems={total}
            pageSize={pageSize}
            page={page}
            pageSizes={[10, 20, 50]}
            onChange={({ page: p, pageSize: ps }) => { setPage(p); setPageSize(ps); }}
          />
        </>
      )}

      <ConfirmModal
        open={confirmModal.open}
        title="Void Invoice"
        message="Are you sure you want to void this invoice?"
        confirmText="Void"
        onConfirm={confirmVoid}
        onCancel={() => setConfirmModal({ open: false, id: null })}
      />

      <PaymentModal
        open={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, invoiceId: null, invoiceNumber: '', amountDue: 0 })}
        invoiceId={paymentModal.invoiceId}
        invoiceNumber={paymentModal.invoiceNumber}
        amountDue={paymentModal.amountDue}
        onSuccess={fetchInvoices}
      />
    </div>
  );
}
