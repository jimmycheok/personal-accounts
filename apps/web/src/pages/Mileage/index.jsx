import { useState, useEffect } from 'react';
import {
  Tile,
  DataTable,
  TableContainer,
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
  ComposedModal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import api from '../../services/api.js';
import { format } from 'date-fns';

const HEADERS = [
  { key: 'date', header: 'Date' },
  { key: 'from_location', header: 'From' },
  { key: 'to_location', header: 'To' },
  { key: 'distance_km', header: 'Distance (km)' },
  { key: 'purpose', header: 'Purpose' },
  { key: 'deduction', header: 'Deduction' },
  { key: 'actions', header: '' },
];

const PURPOSES = ['client_visit', 'business_meeting', 'site_inspection', 'purchase', 'bank', 'government_office', 'other'];
const MY_MILEAGE_RATE = 0.30; // RM 0.30 per km (Malaysia LHDN rate)

const EMPTY_FORM = () => ({
  log_date: new Date().toISOString().slice(0, 10),
  from_location: '',
  to_location: '',
  km: '',
  purpose: 'client_visit',
  notes: '',
  round_trip: false,
});

const purposeLabel = (p) => (p || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export default function MileagePage() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logOpen, setLogOpen] = useState(false);
  const [viewEntry, setViewEntry] = useState(null);

  // Log trip form state
  const [form, setForm] = useState(EMPTY_FORM());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const fetchMileage = async () => {
    setLoading(true);
    try {
      const res = await api.get('/mileage');
      setEntries(res.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMileage(); }, []);

  const openLog = () => {
    setForm(EMPTY_FORM());
    setFormError('');
    setLogOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.from_location || !form.to_location || !form.km) {
      setFormError('From, To and Distance are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const km = Number(form.km) * (form.round_trip ? 2 : 1);
      await api.post('/mileage', {
        log_date: form.log_date,
        from_location: form.from_location,
        to_location: form.to_location,
        purpose: form.purpose,
        notes: form.notes,
        km,
      });
      setLogOpen(false);
      fetchMileage();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to log mileage');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this mileage entry?')) return;
    try {
      await api.delete(`/mileage/${id}`);
      if (viewEntry && String(viewEntry.id) === String(id)) setViewEntry(null);
      fetchMileage();
    } catch (err) {
      alert('Failed to delete');
    }
  };

  const estimatedDeduction = Number(form.km || 0) * (form.round_trip ? 2 : 1) * MY_MILEAGE_RATE;

  const totalKm = entries.reduce((s, e) => s + Number(e.km || 0), 0);
  const totalDeduction = entries.reduce((s, e) => s + Number(e.deductible_amount || 0), 0);

  const rows = entries.map(e => ({
    id: String(e.id),
    date: e.log_date,
    from_location: e.from_location,
    to_location: e.to_location,
    distance_km: `${Number(e.km).toFixed(1)} km`,
    purpose: purposeLabel(e.purpose),
    deduction: `RM ${Number(e.deductible_amount || 0).toFixed(2)}`,
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Mileage Log</h1>
        <Button renderIcon={Add} onClick={openLog}>Log Trip</Button>
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

      {loading ? <InlineLoading description="Loading mileage log..." /> : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer title="Mileage Log">
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    {headers.map(h => <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableRows.map(row => {
                    const entry = entries.find(e => String(e.id) === row.id);
                    return (
                      <TableRow {...getRowProps({ row })} key={row.id} style={{ cursor: 'pointer' }}>
                        {row.cells.map(cell => (
                          <TableCell
                            key={cell.id}
                            onClick={cell.info.header !== 'actions' ? () => setViewEntry(entry) : undefined}
                          >
                            {cell.info.header === 'actions'
                              ? <OverflowMenu flipped size="sm">
                                  <OverflowMenuItem itemText="View" onClick={() => setViewEntry(entry)} />
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
                          No mileage entries yet. Click "Log Trip" to record your first business trip.
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

      {/* Log Trip Modal */}
      <ComposedModal open={logOpen} onClose={() => setLogOpen(false)} size="md">
        <ModalHeader title="Log New Trip" />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {formError && <InlineNotification kind="error" title={formError} />}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <DatePicker
                datePickerType="single"
                value={form.log_date ? new Date(form.log_date) : null}
                onChange={([d]) => { if (d) setForm(p => ({ ...p, log_date: format(d, 'yyyy-MM-dd') })); }}
              >
                <DatePickerInput id="mil-date" labelText="Date" placeholder="YYYY-MM-DD" />
              </DatePicker>
              <Select
                id="mil-purpose"
                labelText="Purpose"
                value={form.purpose}
                onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))}
              >
                {PURPOSES.map(p => (
                  <SelectItem key={p} value={p} text={purposeLabel(p)} />
                ))}
              </Select>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextInput
                id="mil-from"
                labelText="From Location *"
                value={form.from_location}
                onChange={e => setForm(p => ({ ...p, from_location: e.target.value }))}
                placeholder="e.g. Office, Petaling Jaya"
              />
              <TextInput
                id="mil-to"
                labelText="To Location *"
                value={form.to_location}
                onChange={e => setForm(p => ({ ...p, to_location: e.target.value }))}
                placeholder="e.g. Client Office, KLCC"
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <TextInput
                id="mil-km"
                labelText="Distance (km) *"
                type="number"
                step="0.1"
                value={form.km}
                onChange={e => setForm(p => ({ ...p, km: e.target.value }))}
                placeholder="e.g. 25.5"
              />
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
                <Tag type="blue">Est. Deduction: RM {estimatedDeduction.toFixed(2)}</Tag>
              </div>
            </div>

            <TextArea
              id="mil-notes"
              labelText="Notes"
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              rows={2}
            />
          </div>
        </ModalBody>
        <ModalFooter>
          <Button kind="secondary" onClick={() => setLogOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving} renderIcon={Add}>
            {saving ? 'Logging...' : 'Log Trip'}
          </Button>
        </ModalFooter>
      </ComposedModal>

      {/* View Trip Modal */}
      <ComposedModal open={!!viewEntry} onClose={() => setViewEntry(null)} size="md">
        <ModalHeader title="Trip Details" />
        <ModalBody>
          {viewEntry && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Date</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{viewEntry.log_date || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Purpose</p>
                  <p style={{ margin: 0 }}>{purposeLabel(viewEntry.purpose)}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>From</p>
                  <p style={{ margin: 0 }}>{viewEntry.from_location || '-'}</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>To</p>
                  <p style={{ margin: 0 }}>{viewEntry.to_location || '-'}</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Distance</p>
                  <p style={{ fontWeight: 600, margin: 0 }}>{Number(viewEntry.km).toFixed(1)} km</p>
                </div>
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Tax Deduction</p>
                  <p style={{ fontWeight: 600, margin: 0, color: '#0e6027' }}>
                    RM {Number(viewEntry.deductible_amount || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {viewEntry.notes && (
                <div>
                  <p style={{ fontSize: '0.75rem', color: '#525252', marginBottom: '0.25rem' }}>Notes</p>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{viewEntry.notes}</p>
                </div>
              )}

              <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#8d8d8d', margin: 0 }}>
                  Rate: RM {Number(viewEntry.rate_per_km || MY_MILEAGE_RATE).toFixed(2)}/km · Entry #{viewEntry.id}
                </p>
              </div>
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button kind="danger--ghost" onClick={() => { handleDelete(viewEntry?.id); }} disabled={!viewEntry}>
            Delete
          </Button>
          <Button kind="secondary" onClick={() => setViewEntry(null)}>Close</Button>
        </ModalFooter>
      </ComposedModal>
    </div>
  );
}
