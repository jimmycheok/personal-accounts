import React, { useState, useEffect } from 'react';
import {
  Tile,
  TextInput,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  Button,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TextArea,
  InlineNotification,
  InlineLoading,
  NumberInput,
  ComboBox,
} from '@carbon/react';
import { format } from 'date-fns';
import { Add, TrashCan, UserFollow } from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';
import CustomerQuickCreateModal from '../../components/CustomerQuickCreateModal.jsx';

const DEFAULT_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0, amount: 0 };

function calcLine(line) {
  const subtotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
  const tax = subtotal * (Number(line.tax_rate || 0) / 100);
  return { ...line, amount: subtotal + tax };
}

export default function InvoiceFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showNewCustomer, setShowNewCustomer] = useState(false);

  const [form, setForm] = useState({
    customer_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    due_date: '',
    payment_terms: 30,
    notes: '',
    currency: 'MYR',
    po_number: '',
  });
  const [lines, setLines] = useState([{ ...DEFAULT_LINE }]);

  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data.customers || [])).catch(console.error);
    if (isEdit) {
      api.get(`/invoices/${id}`).then(res => {
        const inv = res.data;
        setForm({
          customer_id: inv.customer_id,
          issue_date: inv.issue_date,
          due_date: inv.due_date,
          payment_terms: inv.payment_terms || 30,
          notes: inv.notes || '',
          currency: inv.currency || 'MYR',
          po_number: inv.po_number || '',
        });
        setLines(inv.items?.length ? inv.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate || 0,
          amount: item.amount,
        })) : [{ ...DEFAULT_LINE }]);
      }).catch(console.error).finally(() => setLoading(false));
    }
  }, [id]);

  const updateForm = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const updateLine = (idx, key, val) => {
    setLines(prev => {
      const updated = [...prev];
      updated[idx] = calcLine({ ...updated[idx], [key]: val });
      return updated;
    });
  };

  const addLine = () => setLines(p => [...p, { ...DEFAULT_LINE }]);
  const removeLine = (idx) => setLines(p => p.filter((_, i) => i !== idx));

  const subtotal = lines.reduce((s, l) => {
    const st = Number(l.quantity || 0) * Number(l.unit_price || 0);
    return s + st;
  }, 0);
  const totalTax = lines.reduce((s, l) => {
    const st = Number(l.quantity || 0) * Number(l.unit_price || 0);
    return s + st * (Number(l.tax_rate || 0) / 100);
  }, 0);
  const total = subtotal + totalTax;

  const handleSave = async (status = 'draft') => {
    if (!form.customer_id) { setError('Please select a customer'); return; }
    if (!form.issue_date) { setError('Issue date is required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        status,
        items: lines.map(l => ({
          description: l.description,
          quantity: Number(l.quantity),
          unit_price: Number(l.unit_price),
          tax_rate: Number(l.tax_rate),
          amount: Number(l.amount),
        })),
      };
      if (isEdit) {
        await api.put(`/invoices/${id}`, payload);
      } else {
        await api.post('/invoices', payload);
      }
      navigate('/invoices');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save invoice');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoading description="Loading invoice..." />;

  const selectedCustomer = customers.find(c => String(c.id) === String(form.customer_id));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
        <Button kind="ghost" onClick={() => navigate('/invoices')}>Cancel</Button>
      </div>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 className="form-section-title">Invoice Details</h3>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <div>
            <ComboBox
              id="customer_id"
              titleText="Customer *"
              placeholder="Select or search customer"
              items={customers}
              itemToString={item => item ? item.name : ''}
              selectedItem={selectedCustomer || null}
              onChange={({ selectedItem }) => updateForm('customer_id', selectedItem?.id || '')}
            />
            <Button
              kind="ghost"
              size="sm"
              renderIcon={UserFollow}
              onClick={() => setShowNewCustomer(true)}
              style={{ marginTop: '0.25rem', padding: '0.25rem 0.5rem' }}
            >
              New Customer
            </Button>
          </div>
          <TextInput
            id="po_number"
            labelText="PO Number"
            value={form.po_number}
            onChange={e => updateForm('po_number', e.target.value)}
            placeholder="Optional purchase order number"
          />
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <DatePicker datePickerType="single" value={new Date(form.issue_date)} onChange={([d]) => {
            if (d) updateForm('issue_date', format(d, 'yyyy-MM-dd'));
          }}>
            <DatePickerInput id="issue_date" labelText="Issue Date *" placeholder="YYYY-MM-DD" />
          </DatePicker>
          <DatePicker datePickerType="single" value={new Date(form.due_date)} onChange={([d]) => {
            if (d) updateForm('due_date', format(d, 'yyyy-MM-dd'));
          }}>
            <DatePickerInput id="due_date" labelText="Due Date" placeholder="YYYY-MM-DD" />
          </DatePicker>
        </div>
        <div className="grid-2">
          <Select id="payment_terms" labelText="Payment Terms (days)" value={String(form.payment_terms)}
            onChange={e => updateForm('payment_terms', Number(e.target.value))}>
            <SelectItem value="0" text="Due on Receipt" />
            <SelectItem value="7" text="Net 7" />
            <SelectItem value="14" text="Net 14" />
            <SelectItem value="30" text="Net 30" />
            <SelectItem value="60" text="Net 60" />
          </Select>
          <Select id="currency" labelText="Currency" value={form.currency}
            onChange={e => updateForm('currency', e.target.value)}>
            <SelectItem value="MYR" text="MYR" />
            <SelectItem value="USD" text="USD" />
            <SelectItem value="SGD" text="SGD" />
          </Select>
        </div>
      </Tile>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 className="form-section-title" style={{ margin: 0 }}>Line Items</h3>
          <Button renderIcon={Add} size="sm" onClick={addLine}>Add Item</Button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                <th style={{ textAlign: 'left', padding: '0.5rem', width: '40%' }}>Description</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '10%' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '15%' }}>Unit Price</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '10%' }}>Tax %</th>
                <th style={{ textAlign: 'right', padding: '0.5rem', width: '15%' }}>Amount</th>
                <th style={{ width: '5%' }}></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #e0e0e0' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput
                      id={`desc-${idx}`}
                      labelText=""
                      hideLabel
                      value={line.description}
                      onChange={e => updateLine(idx, 'description', e.target.value)}
                      placeholder="Item description"
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput
                      id={`qty-${idx}`}
                      labelText=""
                      hideLabel
                      type="number"
                      value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', e.target.value)}
                      style={{ textAlign: 'right' }}
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput
                      id={`price-${idx}`}
                      labelText=""
                      hideLabel
                      type="number"
                      step="0.01"
                      value={line.unit_price}
                      onChange={e => updateLine(idx, 'unit_price', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput
                      id={`tax-${idx}`}
                      labelText=""
                      hideLabel
                      type="number"
                      value={line.tax_rate}
                      onChange={e => updateLine(idx, 'tax_rate', e.target.value)}
                    />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                    RM {Number(line.amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <Button
                      kind="ghost"
                      size="sm"
                      renderIcon={TrashCan}
                      iconDescription="Remove"
                      hasIconOnly
                      onClick={() => removeLine(idx)}
                      disabled={lines.length === 1}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e0e0e0' }}>
                <td colSpan={4} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#525252' }}>Subtotal</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>RM {subtotal.toFixed(2)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', color: '#525252' }}>Tax</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>RM {totalTax.toFixed(2)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '0.5rem 0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>Total</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#0f62fe' }}>RM {total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Tile>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 className="form-section-title">Notes</h3>
        <TextArea
          id="notes"
          labelText="Notes / Payment Instructions"
          value={form.notes}
          onChange={e => updateForm('notes', e.target.value)}
          placeholder="e.g. Please pay via bank transfer to Maybank account: 1234-5678-90"
          rows={4}
        />
      </Tile>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <Button kind="secondary" onClick={() => handleSave('draft')} disabled={saving}>
          Save as Draft
        </Button>
        <Button onClick={() => handleSave('sent')} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Send'}
        </Button>
      </div>

      <CustomerQuickCreateModal
        open={showNewCustomer}
        onClose={() => setShowNewCustomer(false)}
        onCreated={(newCustomer) => {
          setCustomers(prev => [...prev, newCustomer]);
          updateForm('customer_id', newCustomer.id);
          setShowNewCustomer(false);
        }}
      />
    </div>
  );
}
