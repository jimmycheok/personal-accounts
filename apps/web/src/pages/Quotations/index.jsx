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
  Select,
  SelectItem,
} from '@carbon/react';
import { Add } from '@carbon/icons-react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api.js';

const STATUS_COLOR = {
  draft: 'gray', sent: 'blue', accepted: 'green', declined: 'red', expired: 'magenta', converted: 'cyan',
};

const HEADERS = [
  { key: 'quotation_number', header: 'Quotation #' },
  { key: 'customer', header: 'Customer' },
  { key: 'issue_date', header: 'Issue Date' },
  { key: 'valid_until', header: 'Valid Until' },
  { key: 'total_amount', header: 'Total' },
  { key: 'status', header: 'Status' },
  { key: 'actions', header: '' },
];

export default function QuotationsPage() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchQuotations = async () => {
    setLoading(true);
    try {
      const res = await api.get('/quotations', { params: { status: statusFilter !== 'all' ? statusFilter : undefined } });
      setQuotations(res.data.quotations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuotations(); }, [statusFilter]);

  const handleConvert = async (id) => {
    if (!window.confirm('Convert this quotation to an invoice?')) return;
    try {
      const res = await api.post(`/quotations/${id}/convert`);
      navigate(`/invoices/${res.data.id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to convert');
    }
  };

  const filtered = quotations.filter(q =>
    !search || q.quotation_number?.toLowerCase().includes(search.toLowerCase())
    || q.customer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const rows = filtered.map(q => ({
    id: String(q.id),
    quotation_number: q.quotation_number,
    customer: q.customer?.name || '-',
    issue_date: q.issue_date,
    valid_until: q.valid_until || '-',
    total_amount: `RM ${Number(q.total_amount || 0).toFixed(2)}`,
    status: q.status,
  }));

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Quotations</h1>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Select id="status-filter" labelText="" value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)} style={{ width: 160 }}>
            <SelectItem value="all" text="All Statuses" />
            <SelectItem value="draft" text="Draft" />
            <SelectItem value="sent" text="Sent" />
            <SelectItem value="accepted" text="Accepted" />
            <SelectItem value="declined" text="Declined" />
            <SelectItem value="expired" text="Expired" />
            <SelectItem value="converted" text="Converted" />
          </Select>
          <Button renderIcon={Add} onClick={() => navigate('/quotations/new')}>New Quotation</Button>
        </div>
      </div>

      {loading ? <InlineLoading description="Loading quotations..." /> : (
        <DataTable rows={rows} headers={HEADERS} isSortable>
          {({ rows: tableRows, headers, getTableProps, getHeaderProps, getRowProps, getToolbarProps }) => (
            <TableContainer>
              <TableToolbar {...getToolbarProps()}>
                <TableToolbarContent>
                  <TableToolbarSearch
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search quotations..."
                  />
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
                    <TableRow {...getRowProps({ row })} key={row.id} style={{ cursor: 'pointer' }}>
                      {row.cells.map(cell => (
                        <TableCell key={cell.id}
                          onClick={cell.info.header !== 'actions' ? () => navigate(`/quotations/${row.id}/edit`) : undefined}>
                          {cell.info.header === 'status' ? (
                            <Tag type={STATUS_COLOR[cell.value] || 'gray'}>{cell.value}</Tag>
                          ) : cell.info.header === 'actions' ? (
                            <OverflowMenu flipped size="sm">
                              <OverflowMenuItem itemText="Edit" onClick={() => navigate(`/quotations/${row.id}/edit`)} />
                              <OverflowMenuItem itemText="Convert to Invoice" onClick={() => handleConvert(row.id)} />
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
                          No quotations found.
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
