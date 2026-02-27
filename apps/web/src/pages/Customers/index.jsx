import React, { useState, useEffect, useCallback } from 'react';
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
  Pagination,
  Modal,
  TextInput,
  Select,
  SelectItem,
  TextArea,
  Toggle,
  InlineNotification,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import api from '../../services/api.js';

const CUSTOMER_TYPE_COLOR = { B2B: 'blue', B2C: 'green', B2G: 'purple' };

const HEADERS = [
  { key: 'name', header: 'Name' },
  { key: 'customer_type', header: 'Type' },
  { key: 'email', header: 'Email' },
  { key: 'phone', header: 'Phone' },
  { key: 'city', header: 'City' },
  { key: 'is_active', header: 'Status' },
  { key: 'actions', header: '' },
];

const EMPTY_FORM = {
  name: '',
  customer_type: 'B2B',
  tin: '',
  id_type: 'BRN',
  id_value: '',
  email: '',
  phone: '',
  address_line1: '',
  address_line2: '',
  city: '',
  postcode: '',
  state: '',
  country: 'Malaysia',
  notes: '',
  is_active: true,
};

const STATES_MY = [
  'Johor', 'Kedah', 'Kelantan', 'Kuala Lumpur', 'Labuan', 'Melaka',
  'Negeri Sembilan', 'Pahang', 'Penang', 'Perak', 'Perlis', 'Putrajaya',
  'Sabah', 'Sarawak', 'Selangor', 'Terengganu',
];

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/customers', {
        params: { search: search || undefined, page, limit: pageSize },
      });
      setCustomers(res.data.customers || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [search, page, pageSize]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const handleSearch = (e) => { setSearch(e.target.value); setPage(1); };
  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name || '',
      customer_type: customer.customer_type || 'B2B',
      tin: customer.tin || '',
      id_type: customer.id_type || 'BRN',
      id_value: customer.id_value || '',
      email: customer.email || '',
      phone: customer.phone || '',
      address_line1: customer.address_line1 || '',
      address_line2: customer.address_line2 || '',
      city: customer.city || '',
      postcode: customer.postcode || '',
      state: customer.state || '',
      country: customer.country || 'Malaysia',
      notes: customer.notes || '',
      is_active: customer.is_active !== false,
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this customer? This cannot be undone.')) return;
    try {
      await api.delete(`/customers/${id}`);
      fetchCustomers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete customer');
    }
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) { setFormError('Customer name is required'); return; }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await api.put(`/customers/${editingId}`, form);
      } else {
        await api.post('/customers', form);
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const rows = customers.map(c => ({
    id: String(c.id),
    name: c.name,
    customer_type: c.customer_type,
    email: c.email || '-',
    phone: c.phone || '-',
    city: c.city || '-',
    is_active: c.is_active,
    _raw: c,
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Customers</h1>
        <Button renderIcon={Add} onClick={openCreate}>New Customer</Button>
      </div>

      {loading ? <InlineLoading description="Loading customers..." /> : (
        <>
          <DataTable rows={rows} headers={HEADERS} isSortable>
            {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
              <TableContainer>
                <TableToolbar {...getToolbarProps()}>
                  <TableToolbarContent>
                    <TableToolbarSearch
                      value={search}
                      onChange={handleSearch}
                      placeholder="Search by name..."
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
                    {tableRows.map(row => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map(cell => (
                          <TableCell key={cell.id}>
                            {cell.info.header === 'customer_type' ? (
                              <Tag type={CUSTOMER_TYPE_COLOR[cell.value] || 'gray'}>{cell.value}</Tag>
                            ) : cell.info.header === 'is_active' ? (
                              <Tag type={cell.value ? 'green' : 'gray'}>{cell.value ? 'Active' : 'Inactive'}</Tag>
                            ) : cell.info.header === 'actions' ? (
                              <OverflowMenu flipped size="sm">
                                <OverflowMenuItem
                                  itemText="Edit"
                                  onClick={() => openEdit(customers.find(c => String(c.id) === row.id))}
                                />
                                <OverflowMenuItem
                                  itemText="Delete"
                                  hasDivider
                                  isDelete
                                  onClick={() => handleDelete(row.id)}
                                />
                              </OverflowMenu>
                            ) : cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                    {tableRows.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={HEADERS.length}>
                          <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                            No customers found.{' '}
                            <button
                              style={{ background: 'none', border: 'none', color: '#0f62fe', cursor: 'pointer' }}
                              onClick={openCreate}
                            >
                              Add your first customer
                            </button>
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

      <Modal
        open={modalOpen}
        modalHeading={editingId ? 'Edit Customer' : 'New Customer'}
        primaryButtonText={saving ? 'Saving...' : (editingId ? 'Save Changes' : 'Create Customer')}
        secondaryButtonText="Cancel"
        onRequestSubmit={handleSubmit}
        onRequestClose={() => setModalOpen(false)}
        primaryButtonDisabled={saving}
        size="lg"
      >
        {formError && <InlineNotification kind="error" title={formError} style={{ marginBottom: '1rem' }} />}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <TextInput
            id="c-name"
            labelText="Name *"
            value={form.name}
            onChange={e => update('name', e.target.value)}
            placeholder="Company or person name"
          />
          <Select id="c-type" labelText="Customer Type" value={form.customer_type} onChange={e => update('customer_type', e.target.value)}>
            <SelectItem value="B2B" text="B2B — Business" />
            <SelectItem value="B2C" text="B2C — Individual" />
            <SelectItem value="B2G" text="B2G — Government" />
          </Select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <TextInput
            id="c-tin"
            labelText="TIN (Tax Identification Number)"
            value={form.tin}
            onChange={e => update('tin', e.target.value)}
            placeholder="e.g. C12345678910"
          />
          <Select id="c-id-type" labelText="ID Type" value={form.id_type} onChange={e => update('id_type', e.target.value)}>
            <SelectItem value="BRN" text="BRN — Business Reg. No." />
            <SelectItem value="NRIC" text="NRIC — IC Number" />
            <SelectItem value="Passport" text="Passport" />
            <SelectItem value="Army" text="Army ID" />
          </Select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            id="c-id-value"
            labelText="ID Number"
            value={form.id_value}
            onChange={e => update('id_value', e.target.value)}
            placeholder="e.g. 202301234567"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <TextInput
            id="c-email"
            labelText="Email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
            placeholder="email@example.com"
          />
          <TextInput
            id="c-phone"
            labelText="Phone"
            value={form.phone}
            onChange={e => update('phone', e.target.value)}
            placeholder="+601X-XXXXXXX"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            id="c-addr1"
            labelText="Address Line 1"
            value={form.address_line1}
            onChange={e => update('address_line1', e.target.value)}
            placeholder="Street address"
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            id="c-addr2"
            labelText="Address Line 2"
            value={form.address_line2}
            onChange={e => update('address_line2', e.target.value)}
            placeholder="Unit, floor, building (optional)"
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
          <TextInput
            id="c-city"
            labelText="City"
            value={form.city}
            onChange={e => update('city', e.target.value)}
            placeholder="e.g. Kuala Lumpur"
          />
          <TextInput
            id="c-postcode"
            labelText="Postcode"
            value={form.postcode}
            onChange={e => update('postcode', e.target.value)}
            placeholder="e.g. 50000"
          />
          <Select id="c-state" labelText="State" value={form.state} onChange={e => update('state', e.target.value)}>
            <SelectItem value="" text="Select state" />
            {STATES_MY.map(s => <SelectItem key={s} value={s} text={s} />)}
          </Select>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <TextArea
            id="c-notes"
            labelText="Notes"
            value={form.notes}
            onChange={e => update('notes', e.target.value)}
            placeholder="Internal notes about this customer"
            rows={3}
          />
        </div>

        {editingId && (
          <Toggle
            id="c-active"
            labelText="Status"
            labelA="Inactive"
            labelB="Active"
            toggled={form.is_active}
            onToggle={val => update('is_active', val)}
          />
        )}
      </Modal>
    </div>
  );
}
