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
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import api from '../../services/api.js';
import AddExpenseModal from '../../components/AddExpenseModal.jsx';
import AttachmentsPanel from '../../components/AttachmentsPanel.jsx';

const HEADERS = [
  { key: 'date', header: 'Date' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'description', header: 'Description' },
  { key: 'category', header: 'Category' },
  { key: 'amount', header: 'Amount' },
  { key: 'actions', header: '' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await api.get('/expenses');
      setExpenses(res.data.expenses || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchExpenses(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.delete(`/expenses/${id}`);
      fetchExpenses();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete expense');
    }
  };

  const filtered = expenses.filter(e =>
    !search
    || e.vendor_name?.toLowerCase().includes(search.toLowerCase())
    || e.description?.toLowerCase().includes(search.toLowerCase())
    || e.category?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const rows = filtered.map(e => ({
    id: String(e.id),
    date: e.expense_date,
    vendor: e.vendor_name || '-',
    description: e.description || '-',
    category: e.category?.name || '-',
    amount: `RM ${Number(e.amount || 0).toFixed(2)}`,
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Expenses</h1>
        <Button renderIcon={Add} onClick={() => setModalOpen(true)}>Add Expense</Button>
      </div>

      {loading ? <InlineLoading description="Loading expenses..." /> : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <TableContainer>
              <TableToolbar {...getToolbarProps()}>
                <TableToolbarContent>
                  <TableToolbarSearch
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search expenses..."
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
                    const expense = expenses.find(e => String(e.id) === row.id);
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id} style={{ cursor: 'pointer' }}>
                        {row.cells.map(cell => (
                          <TableCell
                            key={cell.id}
                            onClick={cell.info.header !== 'actions' ? () => setViewExpense(expense) : undefined}
                          >
                            {cell.info.header === 'category'
                              ? <Tag type="blue" size="sm">{cell.value}</Tag>
                              : cell.info.header === 'actions'
                              ? <OverflowMenu flipped size="sm">
                                  <OverflowMenuItem itemText="View" onClick={() => setViewExpense(expense)} />
                                  <OverflowMenuItem itemText="Delete" isDelete onClick={() => handleDelete(row.id)} />
                                </OverflowMenu>
                              : cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    );
                  })}
                  {tableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={HEADERS.length}>
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                          No expenses recorded yet.
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      )}

      <AddExpenseModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={fetchExpenses}
      />

      {/* View Expense Modal */}
      <ComposedModal open={!!viewExpense} onClose={() => setViewExpense(null)} size="md">
        <ModalHeader title="Expense Details" />
        <ModalBody>
          {viewExpense && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Vendor / Supplier</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{viewExpense.vendor_name || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Amount</p>
                  <p style={{ fontWeight: 600, margin: 0, color: '#da1e28' }}>
                    RM {Number(viewExpense.amount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Date</p>
                  <p style={{ margin: 0 }}>{viewExpense.expense_date || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Category</p>
                  {viewExpense.category
                    ? <Tag type="blue" size="sm">
                        {viewExpense.category.borang_b_section
                          ? `${viewExpense.category.borang_b_section} — ${viewExpense.category.name}`
                          : viewExpense.category.name}
                      </Tag>
                    : <p style={{ margin: 0 }}>-</p>}
                </div>
              </div>

              {viewExpense.description && (
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Description</p>
                  <p style={{ margin: 0 }}>{viewExpense.description}</p>
                </div>
              )}

              {viewExpense.notes && (
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Notes</p>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{viewExpense.notes}</p>
                </div>
              )}

              <AttachmentsPanel subjectType="expense" subjectId={viewExpense.id} />
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setViewExpense(null)}>Close</Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
