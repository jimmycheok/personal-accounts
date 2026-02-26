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
  Button,
  Tag,
  InlineLoading,
  OverflowMenu,
  OverflowMenuItem,
  Modal,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  ComboBox,
  InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import api from '../../services/api.js';

const STATUS_COLOR = { draft: 'gray', issued: 'blue', applied: 'green', void: 'magenta' };

const HEADERS = [
  { key: 'credit_note_number', header: 'Credit Note #' },
  { key: 'invoice', header: 'Related Invoice' },
  { key: 'customer', header: 'Customer' },
  { key: 'issue_date', header: 'Issue Date' },
  { key: 'amount', header: 'Amount' },
  { key: 'reason', header: 'Reason' },
  { key: 'status', header: 'Status' },
  { key: 'actions', header: '' },
];

function NewCreditNoteModal({ open, onClose, onSuccess }) {
  const [invoices, setInvoices] = useState([]);
  const [form, setForm] = useState({ invoice_id: '', amount: '', reason: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      api.get('/invoices', { params: { status: 'paid', limit: 100 } })
        .then(res => setInvoices(res.data.invoices || []))
        .catch(console.error);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.invoice_id || !form.amount) { setError('Invoice and amount are required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/credit-notes', { ...form, amount: Number(form.amount) });
      onSuccess();
      onClose();
      setForm({ invoice_id: '', amount: '', reason: '', notes: '' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create credit note');
    } finally {
      setSaving(false);
    }
  };

  const selectedInvoice = invoices.find(inv => String(inv.id) === String(form.invoice_id));

  return (
    <Modal open={open} onRequestClose={onClose} modalHeading="Issue Credit Note"
      primaryButtonText={saving ? 'Issuing...' : 'Issue Credit Note'}
      secondaryButtonText="Cancel" onRequestSubmit={handleSubmit} primaryButtonDisabled={saving}>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <ComboBox
          id="invoice_id"
          titleText="Related Invoice *"
          placeholder="Select invoice"
          items={invoices}
          itemToString={item => item ? `${item.invoice_number} — ${item.customer?.name}` : ''}
          selectedItem={selectedInvoice || null}
          onChange={({ selectedItem }) => setForm(p => ({ ...p, invoice_id: selectedItem?.id || '' }))}
        />
        <TextInput id="cn-amount" labelText="Credit Amount (RM) *" type="number" step="0.01"
          value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
        <Select id="cn-reason" labelText="Reason" value={form.reason}
          onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}>
          <SelectItem value="" text="Select reason..." />
          <SelectItem value="returned_goods" text="Returned Goods" />
          <SelectItem value="overcharge" text="Overcharge / Billing Error" />
          <SelectItem value="discount" text="Discount Applied" />
          <SelectItem value="service_not_rendered" text="Service Not Rendered" />
          <SelectItem value="other" text="Other" />
        </Select>
        <TextArea id="cn-notes" labelText="Notes" value={form.notes}
          onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={3} />
      </div>
    </Modal>
  );
}

export default function CreditNotesPage() {
  const [creditNotes, setCreditNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);

  const fetchCreditNotes = async () => {
    setLoading(true);
    try {
      const res = await api.get('/credit-notes');
      setCreditNotes(res.data.creditNotes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCreditNotes(); }, []);

  const filtered = creditNotes.filter(cn =>
    !search || cn.credit_note_number?.toLowerCase().includes(search.toLowerCase())
    || cn.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const rows = filtered.map(cn => ({
    id: String(cn.id),
    credit_note_number: cn.credit_note_number,
    invoice: cn.invoice?.invoice_number || '-',
    customer: cn.customer?.name || cn.invoice?.customer?.name || '-',
    issue_date: cn.issue_date,
    amount: `RM ${Number(cn.amount || 0).toFixed(2)}`,
    reason: cn.reason || '-',
    status: cn.status,
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Credit Notes</h1>
        <Button renderIcon={Add} onClick={() => setModalOpen(true)}>Issue Credit Note</Button>
      </div>

      {loading ? <InlineLoading description="Loading credit notes..." /> : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <TableContainer>
              <TableToolbar {...getToolbarProps()}>
                <TableToolbarContent>
                  <TableToolbarSearch value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." />
                </TableToolbarContent>
              </TableToolbar>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map(h => <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map(row => (
                    <TableRow {...getRowProps({ row })} key={row.id}>
                      {row.cells.map(cell => (
                        <TableCell key={cell.id}>
                          {cell.info.header === 'status'
                            ? <Tag type={STATUS_COLOR[cell.value] || 'gray'}>{cell.value}</Tag>
                            : cell.info.header === 'actions'
                            ? <OverflowMenu flipped size="sm">
                                <OverflowMenuItem itemText="View / Print" />
                              </OverflowMenu>
                            : cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {tableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={HEADERS.length}>
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>No credit notes found.</div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      <NewCreditNoteModal open={modalOpen} onClose={() => setModalOpen(false)} onSuccess={fetchCreditNotes} />
    </div>
  );
}
