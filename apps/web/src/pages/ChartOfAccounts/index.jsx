import React, { useState, useEffect } from 'react';
import {
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Button,
  Tag,
  Select,
  SelectItem,
  InlineLoading,
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
  TextInput,
  InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const TYPE_COLORS = {
  asset: 'green',
  liability: 'red',
  equity: 'blue',
  revenue: 'purple',
  expense: 'orange',
};

const SUB_TYPE_LABELS = {
  current_asset: 'Current Asset',
  fixed_asset: 'Fixed Asset',
  current_liability: 'Current Liability',
  long_term_liability: 'Long-term Liability',
  equity: 'Equity',
  revenue: 'Revenue',
  other_income: 'Other Income',
  cogs: 'Cost of Goods Sold',
  operating_expense: 'Operating Expense',
};

const headers = [
  { key: 'code', header: 'Code' },
  { key: 'name', header: 'Name' },
  { key: 'account_type', header: 'Type' },
  { key: 'sub_type', header: 'Sub-type' },
  { key: 'borang_b_section', header: 'Borang B' },
  { key: 'status', header: 'Status' },
];

export default function ChartOfAccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', name: '', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: '', description: '' });

  useEffect(() => {
    loadAccounts();
  }, [filter]);

  const loadAccounts = async () => {
    try {
      const params = filter ? { type: filter } : {};
      const res = await api.get('/accounts', { params });
      setAccounts(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      setError('');
      await api.post('/accounts', form);
      setModalOpen(false);
      setForm({ code: '', name: '', account_type: 'expense', sub_type: 'operating_expense', borang_b_section: '', description: '' });
      loadAccounts();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create account');
    }
  };

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase()) || a.code.includes(search)
  );

  const rows = filtered.map(a => ({
    id: String(a.id),
    code: a.code,
    name: a.name,
    account_type: a.account_type,
    sub_type: SUB_TYPE_LABELS[a.sub_type] || a.sub_type,
    borang_b_section: a.borang_b_section || '—',
    status: a.is_active ? 'Active' : 'Inactive',
  }));

  if (loading) return <InlineLoading description="Loading accounts..." />;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Chart of Accounts</h1>
        <Button renderIcon={Add} onClick={() => setModalOpen(true)}>Add Account</Button>
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <Select id="type-filter" labelText="" hideLabel value={filter} onChange={e => setFilter(e.target.value)} style={{ maxWidth: '200px' }}>
          <SelectItem value="" text="All Types" />
          <SelectItem value="asset" text="Assets" />
          <SelectItem value="liability" text="Liabilities" />
          <SelectItem value="equity" text="Equity" />
          <SelectItem value="revenue" text="Revenue" />
          <SelectItem value="expense" text="Expenses" />
        </Select>
      </div>

      <DataTable rows={rows} headers={headers} isSortable>
        {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps, onInputChange }) => (
          <TableContainer>
            <TableToolbar>
              <TableToolbarContent>
                <TableToolbarSearch onChange={(e) => setSearch(e.target.value)} placeholder="Search accounts..." />
              </TableToolbarContent>
            </TableToolbar>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {tableHeaders.map(h => <TableHeader key={h.key} {...getHeaderProps({ header: h })}>{h.header}</TableHeader>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map(row => {
                  const acct = accounts.find(a => String(a.id) === row.id);
                  return (
                    <TableRow
                      key={row.id}
                      {...getRowProps({ row })}
                      onClick={() => navigate(`/chart-of-accounts/${acct.id}/ledger`)}
                      style={{ cursor: 'pointer' }}
                    >
                      {row.cells.map(cell => (
                        <TableCell key={cell.id}>
                          {cell.info.header === 'account_type' ? (
                            <Tag type={TYPE_COLORS[cell.value]} size="sm">{cell.value.charAt(0).toUpperCase() + cell.value.slice(1)}</Tag>
                          ) : cell.info.header === 'status' ? (
                            <Tag type={cell.value === 'Active' ? 'green' : 'gray'} size="sm">{cell.value}</Tag>
                          ) : cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>

      <ComposedModal open={modalOpen} onClose={() => setModalOpen(false)}>
        <ModalHeader title="Add Account" />
        <ModalBody>
          {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
          <div style={{ display: 'grid', gap: '1rem' }}>
            <TextInput id="acct-code" labelText="Account Code *" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. 7100" />
            <TextInput id="acct-name" labelText="Account Name *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Marketing Expenses" />
            <Select id="acct-type" labelText="Account Type" value={form.account_type} onChange={e => setForm(p => ({ ...p, account_type: e.target.value }))}>
              <SelectItem value="asset" text="Asset" />
              <SelectItem value="liability" text="Liability" />
              <SelectItem value="equity" text="Equity" />
              <SelectItem value="revenue" text="Revenue" />
              <SelectItem value="expense" text="Expense" />
            </Select>
            <Select id="acct-subtype" labelText="Sub-type" value={form.sub_type} onChange={e => setForm(p => ({ ...p, sub_type: e.target.value }))}>
              <SelectItem value="current_asset" text="Current Asset" />
              <SelectItem value="fixed_asset" text="Fixed Asset" />
              <SelectItem value="current_liability" text="Current Liability" />
              <SelectItem value="long_term_liability" text="Long-term Liability" />
              <SelectItem value="equity" text="Equity" />
              <SelectItem value="revenue" text="Revenue" />
              <SelectItem value="other_income" text="Other Income" />
              <SelectItem value="cogs" text="Cost of Goods Sold" />
              <SelectItem value="operating_expense" text="Operating Expense" />
            </Select>
            <TextInput id="acct-bb" labelText="Borang B Section" value={form.borang_b_section} onChange={e => setForm(p => ({ ...p, borang_b_section: e.target.value }))} placeholder="e.g. D15 (optional)" />
            <TextInput id="acct-desc" labelText="Description" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional description" />
          </div>
        </ModalBody>
        <ModalFooter primaryButtonText="Create" secondaryButtonText="Cancel" onRequestSubmit={handleCreate} onRequestClose={() => setModalOpen(false)} />
      </ComposedModal>
    </div>
  );
}
