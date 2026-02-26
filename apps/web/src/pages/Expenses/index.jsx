import React, { useState, useEffect, useRef } from 'react';
import {
  Tile,
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
  FileUploader,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  InlineNotification,
  OverflowMenu,
  OverflowMenuItem,
} from '@carbon/react';
import { Add, Upload, Bot } from '@carbon/icons-react';
import api from '../../services/api.js';

const EXPENSE_HEADERS = [
  { key: 'date', header: 'Date' },
  { key: 'description', header: 'Description' },
  { key: 'category', header: 'Category' },
  { key: 'vendor', header: 'Vendor' },
  { key: 'amount', header: 'Amount' },
  { key: 'status', header: 'Status' },
  { key: 'actions', header: '' },
];

const STATUS_COLOR = { pending: 'gray', approved: 'green', rejected: 'red' };

const CATEGORIES = [
  'office_supplies', 'travel', 'meals', 'utilities', 'rent', 'insurance',
  'professional_fees', 'marketing', 'equipment', 'software', 'other',
];

function OCRChatPanel({ onExpenseExtracted }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hi! Upload a receipt image or PDF and I\'ll extract the expense details for you automatically.' }
  ]);
  const [uploading, setUploading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  useEffect(scrollToBottom, [messages]);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    setUploading(true);
    setMessages(prev => [...prev, { role: 'user', content: `Uploading: ${file.name}` }]);
    try {
      const formData = new FormData();
      formData.append('receipt', file);
      const res = await api.post('/expenses/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data = res.data;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `I found the following details:\n\n**Vendor:** ${data.vendor || 'Unknown'}\n**Amount:** RM ${Number(data.amount || 0).toFixed(2)}\n**Date:** ${data.date || 'Unknown'}\n**Category:** ${data.category || 'other'}\n\nShall I add this expense?`,
      }]);
      if (onExpenseExtracted) onExpenseExtracted(data);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t process that receipt. Please try again or enter the details manually.',
      }]);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput;
    setChatInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    try {
      const res = await api.post('/expenses/chat', {
        message: userMsg,
        history: messages,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.response }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble responding right now.',
      }]);
    }
  };

  return (
    <Tile style={{ padding: '1.5rem', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        <Bot size={20} />
        <h3 style={{ fontWeight: 600, margin: 0 }}>AI Receipt Assistant</h3>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', minHeight: '300px', maxHeight: '400px', marginBottom: '1rem', border: '1px solid #e0e0e0', borderRadius: '4px', padding: '1rem', background: '#fafafa' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{
            marginBottom: '0.75rem',
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '0.5rem 0.75rem',
              borderRadius: '8px',
              background: msg.role === 'user' ? '#0f62fe' : '#e0e0e0',
              color: msg.role === 'user' ? '#fff' : '#161616',
              fontSize: '0.875rem',
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}
        {uploading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '0.75rem' }}>
            <InlineLoading description="Processing receipt..." />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ marginBottom: '1rem' }}>
        <FileUploader
          labelTitle=""
          labelDescription="Upload receipt (image or PDF)"
          buttonLabel="Upload Receipt"
          accept={['.jpg', '.jpeg', '.png', '.pdf']}
          size="sm"
          onChange={e => handleFileUpload(Array.from(e.target.files || []))}
        />
      </div>

      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <TextInput
          id="chat-input"
          labelText=""
          hideLabel
          value={chatInput}
          onChange={e => setChatInput(e.target.value)}
          placeholder="Ask about expenses..."
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{ flex: 1 }}
        />
        <Button size="sm" onClick={handleSend}>Send</Button>
      </div>
    </Tile>
  );
}

function AddExpenseForm({ prefill, onSuccess }) {
  const [form, setForm] = useState({
    description: prefill?.description || '',
    amount: prefill?.amount || '',
    date: prefill?.date || new Date().toISOString().slice(0, 10),
    category: prefill?.category || 'other',
    vendor: prefill?.vendor || '',
    notes: '',
    currency: 'MYR',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (prefill) {
      setForm(p => ({ ...p, ...prefill }));
    }
  }, [prefill]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.description || !form.amount) { setError('Description and amount are required'); return; }
    setSaving(true);
    setError('');
    try {
      await api.post('/expenses', { ...form, amount: Number(form.amount) });
      onSuccess();
      setForm({ description: '', amount: '', date: new Date().toISOString().slice(0, 10), category: 'other', vendor: '', notes: '', currency: 'MYR' });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add expense');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Add Expense</h3>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      <form onSubmit={handleSubmit}>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <TextInput id="exp-desc" labelText="Description *" value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What was this expense for?" />
          <TextInput id="exp-vendor" labelText="Vendor / Supplier" value={form.vendor}
            onChange={e => setForm(p => ({ ...p, vendor: e.target.value }))} placeholder="e.g. Watsons, TNB" />
        </div>
        <div className="grid-3" style={{ marginBottom: '1rem' }}>
          <TextInput id="exp-amount" labelText="Amount (RM) *" type="number" step="0.01" value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} />
          <DatePicker datePickerType="single" value={form.date}
            onChange={([d]) => { if (d) setForm(p => ({ ...p, date: d.toISOString().slice(0, 10) })); }}>
            <DatePickerInput id="exp-date" labelText="Date" placeholder="YYYY-MM-DD" />
          </DatePicker>
          <Select id="exp-category" labelText="Category" value={form.category}
            onChange={e => setForm(p => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.map(cat => (
              <SelectItem key={cat} value={cat} text={cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
            ))}
          </Select>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <TextArea id="exp-notes" labelText="Notes" value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
        </div>
        <Button type="submit" renderIcon={Add} disabled={saving}>
          {saving ? 'Adding...' : 'Add Expense'}
        </Button>
      </form>
    </Tile>
  );
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [prefill, setPrefill] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);

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

  const handleExtracted = (data) => {
    setPrefill(data);
    setShowAddForm(true);
  };

  const filtered = expenses.filter(e =>
    !search || e.description?.toLowerCase().includes(search.toLowerCase())
    || e.vendor?.toLowerCase().includes(search.toLowerCase())
    || e.category?.toLowerCase().includes(search.toLowerCase())
  );

  const rows = filtered.map(e => ({
    id: String(e.id),
    date: e.date,
    description: e.description,
    category: e.category,
    vendor: e.vendor || '-',
    amount: `RM ${Number(e.amount || 0).toFixed(2)}`,
    status: e.status || 'approved',
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Expenses</h1>
        <Button renderIcon={Add} onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Hide Form' : 'Add Expense'}
        </Button>
      </div>

      <div className="grid-2" style={{ marginBottom: '1.5rem', alignItems: 'start' }}>
        <OCRChatPanel onExpenseExtracted={handleExtracted} />
        <div>
          {showAddForm && <AddExpenseForm prefill={prefill} onSuccess={() => { fetchExpenses(); setPrefill(null); }} />}
          {!showAddForm && (
            <Tile style={{ padding: '1.5rem', textAlign: 'center', color: '#525252' }}>
              <p>Upload a receipt on the left or click "Add Expense" to manually log an expense.</p>
            </Tile>
          )}
        </div>
      </div>

      {loading ? <InlineLoading description="Loading expenses..." /> : (
        <DataTable rows={rows} headers={EXPENSE_HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <TableContainer title="Expense History">
              <TableToolbar {...getToolbarProps()}>
                <TableToolbarContent>
                  <TableToolbarSearch value={search} onChange={e => setSearch(e.target.value)} placeholder="Search expenses..." />
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
                            : cell.info.header === 'category'
                            ? <Tag type="blue">{cell.value}</Tag>
                            : cell.info.header === 'actions'
                            ? <OverflowMenu flipped size="sm">
                                <OverflowMenuItem itemText="Delete" isDelete />
                              </OverflowMenu>
                            : cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {tableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={EXPENSE_HEADERS.length}>
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
    </div>
  );
}
