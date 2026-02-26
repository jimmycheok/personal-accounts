import React, { useState, useEffect } from 'react';
import {
  Tile,
  TextInput,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  Button,
  TextArea,
  InlineNotification,
  InlineLoading,
  ComboBox,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api.js';

const DEFAULT_LINE = { description: '', quantity: 1, unit_price: 0, tax_rate: 0, amount: 0 };

function calcLine(line) {
  const subtotal = Number(line.quantity || 0) * Number(line.unit_price || 0);
  const tax = subtotal * (Number(line.tax_rate || 0) / 100);
  return { ...line, amount: subtotal + tax };
}

export default function QuotationFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);

  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    customer_id: '',
    issue_date: new Date().toISOString().slice(0, 10),
    valid_until: '',
    notes: '',
    currency: 'MYR',
    title: '',
  });
  const [lines, setLines] = useState([{ ...DEFAULT_LINE }]);

  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data.customers || [])).catch(console.error);
    if (isEdit) {
      api.get(`/quotations/${id}`).then(res => {
        const q = res.data;
        setForm({
          customer_id: q.customer_id,
          issue_date: q.issue_date,
          valid_until: q.valid_until || '',
          notes: q.notes || '',
          currency: q.currency || 'MYR',
          title: q.title || '',
        });
        setLines(q.items?.length ? q.items.map(item => ({
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

  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unit_price || 0), 0);
  const totalTax = lines.reduce((s, l) => {
    const st = Number(l.quantity || 0) * Number(l.unit_price || 0);
    return s + st * (Number(l.tax_rate || 0) / 100);
  }, 0);
  const total = subtotal + totalTax;

  const handleSave = async (status = 'draft') => {
    if (!form.customer_id) { setError('Please select a customer'); return; }
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
        await api.put(`/quotations/${id}`, payload);
      } else {
        await api.post('/quotations', payload);
      }
      navigate('/quotations');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save quotation');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InlineLoading description="Loading quotation..." />;

  const selectedCustomer = customers.find(c => String(c.id) === String(form.customer_id));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>{isEdit ? 'Edit Quotation' : 'New Quotation'}</h1>
        <Button kind="ghost" onClick={() => navigate('/quotations')}>Cancel</Button>
      </div>

      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 className="form-section-title">Quotation Details</h3>
        <div style={{ marginBottom: '1rem' }}>
          <TextInput
            id="title"
            labelText="Quotation Title"
            value={form.title}
            onChange={e => updateForm('title', e.target.value)}
            placeholder="e.g. Web Development Project Proposal"
          />
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <ComboBox
            id="customer_id"
            titleText="Customer *"
            placeholder="Select customer"
            items={customers}
            itemToString={item => item ? item.name : ''}
            selectedItem={selectedCustomer || null}
            onChange={({ selectedItem }) => updateForm('customer_id', selectedItem?.id || '')}
          />
          <Select id="currency" labelText="Currency" value={form.currency}
            onChange={e => updateForm('currency', e.target.value)}>
            <SelectItem value="MYR" text="MYR" />
            <SelectItem value="USD" text="USD" />
            <SelectItem value="SGD" text="SGD" />
          </Select>
        </div>
        <div className="grid-2">
          <DatePicker datePickerType="single" value={form.issue_date}
            onChange={([d]) => { if (d) updateForm('issue_date', d.toISOString().slice(0, 10)); }}>
            <DatePickerInput id="issue_date" labelText="Issue Date" placeholder="YYYY-MM-DD" />
          </DatePicker>
          <DatePicker datePickerType="single" value={form.valid_until}
            onChange={([d]) => { if (d) updateForm('valid_until', d.toISOString().slice(0, 10)); }}>
            <DatePickerInput id="valid_until" labelText="Valid Until" placeholder="YYYY-MM-DD" />
          </DatePicker>
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
                    <TextInput id={`desc-${idx}`} labelText="" hideLabel value={line.description}
                      onChange={e => updateLine(idx, 'description', e.target.value)} placeholder="Description" />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput id={`qty-${idx}`} labelText="" hideLabel type="number" value={line.quantity}
                      onChange={e => updateLine(idx, 'quantity', e.target.value)} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput id={`price-${idx}`} labelText="" hideLabel type="number" step="0.01" value={line.unit_price}
                      onChange={e => updateLine(idx, 'unit_price', e.target.value)} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    <TextInput id={`tax-${idx}`} labelText="" hideLabel type="number" value={line.tax_rate}
                      onChange={e => updateLine(idx, 'tax_rate', e.target.value)} />
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>
                    RM {Number(line.amount || 0).toFixed(2)}
                  </td>
                  <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                    <Button kind="ghost" size="sm" renderIcon={TrashCan} iconDescription="Remove" hasIconOnly
                      onClick={() => removeLine(idx)} disabled={lines.length === 1} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e0e0e0' }}>
                <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', color: '#525252' }}>Subtotal</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>RM {subtotal.toFixed(2)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', color: '#525252' }}>Tax</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 600 }}>RM {totalTax.toFixed(2)}</td>
                <td></td>
              </tr>
              <tr>
                <td colSpan={4} style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>Total</td>
                <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem', color: '#0f62fe' }}>RM {total.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Tile>

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 className="form-section-title">Terms & Notes</h3>
        <TextArea id="notes" labelText="Notes / Terms & Conditions" value={form.notes}
          onChange={e => updateForm('notes', e.target.value)}
          placeholder="Payment terms, delivery notes, validity conditions..." rows={4} />
      </Tile>

      <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
        <Button kind="secondary" onClick={() => handleSave('draft')} disabled={saving}>Save as Draft</Button>
        <Button onClick={() => handleSave('sent')} disabled={saving}>
          {saving ? 'Saving...' : 'Save & Send'}
        </Button>
      </div>
    </div>
  );
}
