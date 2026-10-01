import React, { useState, useEffect } from 'react';
import {
  DataTable, Table, TableHead, TableRow, TableHeader, TableBody, TableCell,
  TableContainer, TableToolbar, TableToolbarContent, TableToolbarSearch,
  Button, Tag, Pagination, OverflowMenu, OverflowMenuItem, InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';
import PaymentVoucherModal from '../../components/PaymentVoucherModal.jsx';
import ModuleIntro from '../../components/ModuleIntro.jsx';

const STATUS_TAG = { draft: 'gray', approved: 'green', voided: 'red' };
const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function PaymentVouchersPage() {
  const navigate = useNavigate();
  const [vouchers, setVouchers] = useState([]);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [duplicatePrefill, setDuplicatePrefill] = useState(null);

  const load = () => {
    api.get('/payment-vouchers', { params: { search: search || undefined, limit: 500 } })
      .then(res => setVouchers(res.data.vouchers || []))
      .catch(err => setError(err.response?.data?.error || 'Failed to load payment vouchers'));
  };

  useEffect(() => { load(); }, [search]);

  const handleDelete = async (id) => {
    try { await api.delete(`/payment-vouchers/${id}`); load(); }
    catch (err) { setError(err.response?.data?.error || 'Delete failed'); }
  };

  // Date resets to today and the payment reference is left blank — both belong to the new payment.
  const handleDuplicate = async (id) => {
    try {
      const { data: v } = await api.get(`/payment-vouchers/${id}`);
      setDuplicatePrefill({
        payee_name: v.payee_name || '',
        payee_bank_name: v.payee_bank_name || '',
        payee_bank_account: v.payee_bank_account || '',
        payee_tin: v.payee_tin || '',
        payment_method: v.payment_method || 'bank_transfer',
        description: v.description || '',
        notes: v.notes || '',
        lines: (v.lines || []).map(l => ({ service_item: l.service_item || '', amount: String(l.amount ?? '') })),
      });
      setModalOpen(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load voucher to duplicate');
    }
  };

  const rows = vouchers.map(v => ({
    id: String(v.id),
    pv_number: v.pv_number || '(draft)',
    pv_date: v.pv_date,
    payee_name: v.payee_name,
    total_amount: `RM ${Number(v.total_amount || 0).toFixed(2)}`,
    payment_method: titleCase(v.payment_method),
    status: v.status,
  }));

  const headers = [
    { key: 'pv_number', header: 'PV No.' },
    { key: 'pv_date', header: 'Date' },
    { key: 'payee_name', header: 'Payee' },
    { key: 'total_amount', header: 'Amount' },
    { key: 'payment_method', header: 'Method' },
    { key: 'status', header: 'Status' },
    { key: 'actions', header: '' },
  ];

  const paged = rows.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 400, margin: 0 }}>Payment Vouchers</h1>
          <ModuleIntro>
            Money you paid where <strong>you have to produce the paperwork</strong> — typically a
            freelancer or contractor with no invoice to give you. Issue a voucher as the record.
          </ModuleIntro>
        </div>
        <Button renderIcon={Add} onClick={() => setModalOpen(true)}>New Payment Voucher</Button>
      </div>

      {error && <InlineNotification kind="error" title={error} onClose={() => setError('')} style={{ marginBottom: '1rem' }} />}

      <DataTable rows={paged} headers={headers} isSortable>
        {({ rows, headers, getHeaderProps, getTableProps }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch onChange={(e) => setSearch(e?.target?.value || '')} placeholder="Search payee or PV number" persistent />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {headers.map(header => {
                    const { key, ...rest } = getHeaderProps({ header });
                    return <TableHeader key={header.key} {...rest}>{header.header}</TableHeader>;
                  })}
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map(row => {
                  const v = vouchers.find(x => String(x.id) === row.id);
                  return (
                    <TableRow key={row.id} onClick={() => navigate(`/payment-vouchers/${row.id}`)} style={{ cursor: 'pointer' }}>
                      {row.cells.map(cell => {
                        if (cell.info.header === 'status') {
                          return <TableCell key={cell.id}><Tag type={STATUS_TAG[v.status] || 'gray'}>{titleCase(v.status)}</Tag></TableCell>;
                        }
                        if (cell.info.header === 'actions') {
                          return (
                            <TableCell key={cell.id} onClick={(e) => e.stopPropagation()}>
                              <OverflowMenu flipped aria-label="Actions">
                                <OverflowMenuItem itemText="View" onClick={() => navigate(`/payment-vouchers/${row.id}`)} />
                                <OverflowMenuItem itemText="Duplicate" onClick={() => handleDuplicate(row.id)} />
                                {v.status === 'draft' && <OverflowMenuItem isDelete itemText="Delete" onClick={() => handleDelete(row.id)} />}
                              </OverflowMenu>
                            </TableCell>
                          );
                        }
                        return <TableCell key={cell.id}>{cell.value}</TableCell>;
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <Pagination
        page={page} pageSize={pageSize} pageSizes={[10, 25, 50]} totalItems={rows.length}
        onChange={({ page, pageSize }) => { setPage(page); setPageSize(pageSize); }}
      />

      <PaymentVoucherModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setDuplicatePrefill(null); }}
        onSuccess={() => { setModalOpen(false); setDuplicatePrefill(null); load(); }}
        prefill={duplicatePrefill}
      />
    </div>
  );
}
