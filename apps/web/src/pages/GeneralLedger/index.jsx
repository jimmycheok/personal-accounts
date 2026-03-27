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
  Button,
  Tag,
  Select,
  SelectItem,
  DatePicker,
  DatePickerInput,
  InlineLoading,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import api from '../../services/api.js';

const SOURCE_COLORS = {
  invoice: 'blue',
  payment: 'green',
  expense: 'orange',
  credit_note: 'red',
  manual: 'purple',
  year_end_close: 'cyan',
};

const headers = [
  { key: 'entry_date', header: 'Date' },
  { key: 'reference_number', header: 'Reference' },
  { key: 'description', header: 'Description' },
  { key: 'source_type', header: 'Source' },
  { key: 'status', header: 'Status' },
  { key: 'total', header: 'Total' },
];

export default function GeneralLedgerPage() {
  const navigate = useNavigate();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState('');
  const [from, setFrom] = useState(`${new Date().getFullYear()}-01-01`);
  const [to, setTo] = useState(new Date().toISOString().split('T')[0]);

  const loadEntries = async () => {
    setLoading(true);
    try {
      const params = { from, to, limit: 200 };
      if (sourceFilter) params.source_type = sourceFilter;
      const res = await api.get('/journal-entries', { params });
      setEntries(res.data.entries || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadEntries(); }, [from, to, sourceFilter]);

  const rows = entries.map(e => ({
    id: String(e.id),
    entry_date: e.entry_date,
    reference_number: e.reference_number,
    description: e.description || '',
    source_type: e.source_type || 'manual',
    status: e.status,
    total: `RM ${Number(e.total_debit || 0).toFixed(2)}`,
  }));

  if (loading && entries.length === 0) return <InlineLoading description="Loading journal entries..." />;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>General Ledger</h1>
        <Button renderIcon={Add} onClick={() => navigate('/general-ledger/new')}>New Journal Entry</Button>
      </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <DatePicker datePickerType="single" value={new Date(from)} onChange={([d]) => d && setFrom(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="from" labelText="From" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <DatePicker datePickerType="single" value={new Date(to)} onChange={([d]) => d && setTo(format(d, 'yyyy-MM-dd'))}>
          <DatePickerInput id="to" labelText="To" placeholder="YYYY-MM-DD" />
        </DatePicker>
        <Select id="source-filter" labelText="Source" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} style={{ minWidth: '160px' }}>
          <SelectItem value="" text="All Sources" />
          <SelectItem value="invoice" text="Invoice" />
          <SelectItem value="payment" text="Payment" />
          <SelectItem value="expense" text="Expense" />
          <SelectItem value="credit_note" text="Credit Note" />
          <SelectItem value="manual" text="Manual" />
          <SelectItem value="year_end_close" text="Year-end Close" />
        </Select>
      </div>

      <DataTable rows={rows} headers={headers} isSortable>
        {({ rows: tableRows, headers: tableHeaders, getTableProps, getHeaderProps, getRowProps }) => (
          <TableContainer>
            <Table {...getTableProps()}>
              <TableHead>
                <TableRow>
                  {tableHeaders.map(h => <TableHeader key={h.key} {...getHeaderProps({ header: h })}>{h.header}</TableHeader>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableRows.map(row => (
                  <TableRow
                    key={row.id}
                    {...getRowProps({ row })}
                    onClick={() => navigate(`/general-ledger/${row.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {row.cells.map(cell => (
                      <TableCell key={cell.id}>
                        {cell.info.header === 'source_type' ? (
                          <Tag type={SOURCE_COLORS[cell.value] || 'gray'} size="sm">{cell.value.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</Tag>
                        ) : cell.info.header === 'status' ? (
                          <Tag type={cell.value === 'posted' ? 'green' : 'gray'} size="sm">{cell.value.charAt(0).toUpperCase() + cell.value.slice(1)}</Tag>
                        ) : cell.value}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </DataTable>
    </div>
  );
}
