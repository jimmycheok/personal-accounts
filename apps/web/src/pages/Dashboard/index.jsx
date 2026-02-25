import React, { useState, useEffect } from 'react';
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
  Tag,
  InlineLoading,
  Select,
  SelectItem,
} from '@carbon/react';
import api from '../../services/api.js';

function StatCard({ label, value, currency = true, color = '#0f62fe' }) {
  return (
    <Tile style={{ padding: '1.5rem' }}>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color }}>{currency ? `RM ${Number(value || 0).toFixed(2)}` : value}</div>
      <div style={{ fontSize: '0.875rem', color: '#525252', marginTop: '0.25rem' }}>{label}</div>
    </Tile>
  );
}

export default function DashboardPage() {
  const [overview, setOverview] = useState(null);
  const [outstanding, setOutstanding] = useState([]);
  const [deadlines, setDeadlines] = useState([]);
  const [period, setPeriod] = useState('month');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get(`/dashboard/overview?period=${period}`),
      api.get('/dashboard/outstanding-invoices'),
      api.get('/dashboard/upcoming-deadlines'),
    ]).then(([ov, out, dl]) => {
      setOverview(ov.data);
      setOutstanding(out.data);
      setDeadlines(dl.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [period]);

  if (loading) return <InlineLoading description="Loading dashboard..." />;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Dashboard</h1>
        <Select id="period" labelText="" value={period} onChange={e => setPeriod(e.target.value)} style={{ width: 200 }}>
          <SelectItem value="month" text="This Month" />
          <SelectItem value="quarter" text="This Quarter" />
          <SelectItem value="year" text="This Year" />
        </Select>
      </div>

      <div className="grid-4" style={{ marginBottom: '2rem' }}>
        <StatCard label="Revenue" value={overview?.totalIncome} color="#0e6027" />
        <StatCard label="Expenses" value={overview?.totalExpenses} color="#da1e28" />
        <StatCard label="Net Profit" value={overview?.netProfit} color="#0f62fe" />
        <StatCard label="Outstanding" value={overview?.totalOutstanding} color="#f1620e" />
      </div>

      <div className="grid-2">
        <Tile>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Outstanding Invoices</h3>
          <DataTable rows={outstanding.slice(0, 8).map(inv => ({
            id: String(inv.id),
            number: inv.invoice_number,
            customer: inv.customer?.name || '-',
            amount: `RM ${Number(inv.amount_due).toFixed(2)}`,
            due: inv.due_date,
            status: inv.status,
          }))} headers={[
            { key: 'number', header: 'Invoice' },
            { key: 'customer', header: 'Customer' },
            { key: 'amount', header: 'Amount' },
            { key: 'due', header: 'Due Date' },
            { key: 'status', header: 'Status' },
          ]}>
            {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
              <TableContainer>
                <Table {...getTableProps()}>
                  <TableHead>
                    <TableRow>
                      {headers.map(h => <TableHeader {...getHeaderProps({ header: h })} key={h.key}>{h.header}</TableHeader>)}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {rows.map(row => (
                      <TableRow {...getRowProps({ row })} key={row.id}>
                        {row.cells.map(cell => (
                          <TableCell key={cell.id}>
                            {cell.info.header === 'status'
                              ? <Tag type={cell.value === 'overdue' ? 'red' : 'blue'}>{cell.value}</Tag>
                              : cell.value}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DataTable>
        </Tile>

        <Tile>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Upcoming Deadlines</h3>
          {deadlines.length === 0 ? <p style={{ color: '#525252' }}>No upcoming deadlines</p> : (
            <div>
              {deadlines.map((d, idx) => (
                <div key={idx} style={{ padding: '0.75rem 0', borderBottom: '1px solid #e0e0e0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{d.description}</span>
                    {d.amount && <span style={{ color: '#da1e28' }}>RM {Number(d.amount).toFixed(2)}</span>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#525252', marginTop: '0.25rem' }}>
                    Due: {d.date} {d.customer ? `— ${d.customer}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Tile>
      </div>
    </div>
  );
}
