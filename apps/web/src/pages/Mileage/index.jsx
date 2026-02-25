import React, { useState, useEffect } from 'react';
import {
  Tile,
  DataTable,
  TableContainer,
  TableToolbar,
  TableToolbarContent,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Button,
  TextInput,
  TextArea,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  InlineLoading,
  InlineNotification,
  OverflowMenu,
  OverflowMenuItem,
  Tag,
} from '@carbon/react';
import { Add, TrashCan } from '@carbon/icons-react';
import api from '../../services/api.js';

const HEADERS = [
  { key: 'date', header: 'Date' },
  { key: 'from_location', header: 'From' },
  { key: 'to_location', header: 'To' },
  { key: 'distance_km', header: 'Distance (km)' },
  { key: 'purpose', header: 'Purpose' },
  { key: 'vehicle', header: 'Vehicle' },
  { key: 'deduction', header: 'Deduction' },
  { key: 'actions', header: '' },
];

const PURPOSES = ['client_visit', 'business_meeting', 'site_inspection', 'purchase', 'bank', 'government_office', 'other'];
const MY_MILEAGE_RATE = 0.30; // RM 0.30 per km (Malaysia LHDN rate)

function AddMileageForm({ onSuccess }) {
  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    from_location: '',
    to_location: '',
    distance_km: '',
    purpose: 'client_visit',
    notes: '',
    vehicle_type: 'car',
    round_trip: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.from_location || !form.to_location || !form.distance_km) {
      setError('From, To and Distance are required');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const km = Number(form.distance_km) * (form.round_trip ? 2 : 1);
      await api.post('/mileage', {
        ...form,
        distance_km: km,
        deduction_amount: km * MY_MILEAGE_RATE,
      });
      onSuccess();
      setForm({
        date: new Date().toISOString().slice(0, 10),
        from_location: '', to_location: '', distance_km: '',
        purpose: 'client_visit', notes: '', vehicle_type: 'car', round_trip: false,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to log mileage');
    } finally {
      setSaving(false);
    }
  };

  const estimatedDeduction = Number(form.distance_km || 0) * (form.round_trip ? 2 : 1) * MY_MILEAGE_RATE;

  return (
    <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
      <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Log New Trip</h3>
      {error && <InlineNotification kind="error" title={error} style={{ marginBottom: '1rem' }} />}
      <form onSubmit={handleSubmit}>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <DatePicker datePickerType="single" value={form.date}
            onChange={([d]) => { if (d) setForm(p => ({ ...p, date: d.toISOString().slice(0, 10) })); }}>
            <DatePickerInput id="mil-date" labelText="Date" placeholder="YYYY-MM-DD" />
          </DatePicker>
          <Select id="mil-purpose" labelText="Purpose" value={form.purpose}
            onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}>
            {PURPOSES.map(p => (
              <SelectItem key={p} value={p} text={p.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} />
            ))}
          </Select>
        </div>
        <div className="grid-2" style={{ marginBottom: '1rem' }}>
          <TextInput id="mil-from" labelText="From Location *" value={form.from_location}
            onChange={e => setForm(p => ({ ...p, from_location: e.target.value }))} placeholder="e.g. Office, Petaling Jaya" />
          <TextInput id="mil-to" labelText="To Location *" value={form.to_location}
            onChange={e => setForm(p => ({ ...p, to_location: e.target.value }))} placeholder="e.g. Client Office, KLCC" />
        </div>
        <div className="grid-3" style={{ marginBottom: '1rem' }}>
          <TextInput id="mil-km" labelText="Distance (km) *" type="number" step="0.1" value={form.distance_km}
            onChange={e => setForm(p => ({ ...p, distance_km: e.target.value }))} placeholder="e.g. 25.5" />
          <Select id="mil-vehicle" labelText="Vehicle Type" value={form.vehicle_type}
            onChange={e => setForm(p => ({ ...p, vehicle_type: e.target.value }))}>
            <SelectItem value="car" text="Car" />
            <SelectItem value="motorcycle" text="Motorcycle" />
            <SelectItem value="van" text="Van / Lorry" />
          </Select>
          <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: '0.25rem' }}>
            <label style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.5rem' }}>
              <input
                type="checkbox"
                checked={form.round_trip}
                onChange={e => setForm(p => ({ ...p, round_trip: e.target.checked }))}
                style={{ marginRight: '0.5rem' }}
              />
              Round Trip
            </label>
            <Tag type="blue">
              Est. Deduction: RM {estimatedDeduction.toFixed(2)}
            </Tag>
          </div>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <TextArea id="mil-notes" labelText="Notes" value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
        </div>
        <Button type="submit" renderIcon={Add} disabled={saving}>
          {saving ? 'Logging...' : 'Log Trip'}
        </Button>
      </form>
    </Tile>
  );
}

export default function MileagePage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetchMileage = async () => {
    setLoading(true);
    try {
      const [listRes, summaryRes] = await Promise.all([
        api.get('/mileage'),
        api.get('/mileage/summary').catch(() => ({ data: null })),
      ]);
      setEntries(listRes.data.data || listRes.data);
      setSummary(summaryRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMileage(); }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this mileage entry?')) return;
    try {
      await api.delete(`/mileage/${id}`);
      fetchMileage();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const totalKm = entries.reduce((s, e) => s + Number(e.distance_km || 0), 0);
  const totalDeduction = entries.reduce((s, e) => s + Number(e.deduction_amount || e.distance_km * MY_MILEAGE_RATE || 0), 0);

  const rows = entries.map(e => ({
    id: String(e.id),
    date: e.date,
    from_location: e.from_location,
    to_location: e.to_location,
    distance_km: `${Number(e.distance_km).toFixed(1)} km`,
    purpose: e.purpose?.replace(/_/g, ' ') || '-',
    vehicle: e.vehicle_type || 'car',
    deduction: `RM ${Number(e.deduction_amount || Number(e.distance_km) * MY_MILEAGE_RATE).toFixed(2)}`,
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Mileage Log</h1>
        <Button renderIcon={Add} onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Hide Form' : 'Log Trip'}
        </Button>
      </div>

      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        <Tile style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f62fe' }}>{totalKm.toFixed(1)}</div>
          <div style={{ fontSize: '0.875rem', color: '#525252' }}>Total km Logged</div>
        </Tile>
        <Tile style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0e6027' }}>RM {totalDeduction.toFixed(2)}</div>
          <div style={{ fontSize: '0.875rem', color: '#525252' }}>Total Tax Deduction</div>
        </Tile>
        <Tile style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#525252' }}>{entries.length}</div>
          <div style={{ fontSize: '0.875rem', color: '#525252' }}>Trips Logged</div>
        </Tile>
      </div>

      {showForm && <AddMileageForm onSuccess={fetchMileage} />}

      {loading ? <InlineLoading description="Loading mileage log..." /> : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <TableContainer title="Mileage Log">
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
                          {cell.info.header === 'actions'
                            ? <OverflowMenu flipped size="sm">
                                <OverflowMenuItem itemText="Delete" isDelete onClick={() => handleDelete(row.id)} />
                              </OverflowMenu>
                            : cell.value}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {tableRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={HEADERS.length}>
                        <div style={{ textAlign: 'center', padding: '2rem', color: '#525252' }}>
                          No mileage entries yet. Log your first business trip above.
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

      <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#8d8d8d' }}>
        * Mileage deduction calculated at RM {MY_MILEAGE_RATE.toFixed(2)}/km as per LHDN guidelines.
      </p>
    </div>
  );
}
