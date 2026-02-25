import React, { useState, useEffect } from 'react';
import {
  Tile,
  Select,
  SelectItem,
  InlineLoading,
  Tag,
} from '@carbon/react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import api from '../../services/api.js';

const formatRM = (value) => `RM ${Number(value || 0).toLocaleString('en-MY', { minimumFractionDigits: 0 })}`;

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', padding: '0.75rem', borderRadius: '4px', fontSize: '0.875rem' }}>
        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{label}</p>
        {payload.map((entry, i) => (
          <p key={i} style={{ color: entry.color, margin: '0.25rem 0' }}>
            {entry.name}: {formatRM(entry.value)}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function CashFlowPage() {
  const [data, setData] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState('6');

  useEffect(() => {
    setLoading(true);
    api.get(`/cash-flow?months=${months}`)
      .then(res => {
        const cashFlowData = res.data.monthly || res.data;
        setData(cashFlowData);
        setSummary(res.data.summary || null);
      })
      .catch(() => {
        // Generate placeholder data client-side if API not ready
        const now = new Date();
        const placeholder = Array.from({ length: Number(months) }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (Number(months) - 1 - i), 1);
          return {
            month: d.toLocaleString('default', { month: 'short', year: '2-digit' }),
            income: 0,
            expenses: 0,
            projected_income: 0,
            projected_expenses: 0,
            net: 0,
          };
        });
        setData(placeholder);
      })
      .finally(() => setLoading(false));
  }, [months]);

  const netPositive = data.filter(d => d.net > 0).length;
  const netNegative = data.filter(d => d.net < 0).length;

  if (loading) return <InlineLoading description="Loading cash flow..." />;

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 className="page-title" style={{ margin: 0 }}>Cash Flow</h1>
        <Select id="months" labelText="" value={months} onChange={e => setMonths(e.target.value)} style={{ width: 180 }}>
          <SelectItem value="3" text="Last 3 Months" />
          <SelectItem value="6" text="Last 6 Months" />
          <SelectItem value="12" text="Last 12 Months" />
        </Select>
      </div>

      {summary && (
        <div className="grid-4" style={{ marginBottom: '1.5rem' }}>
          {[
            { label: 'Total Income', value: summary.totalIncome, color: '#0e6027' },
            { label: 'Total Expenses', value: summary.totalExpenses, color: '#da1e28' },
            { label: 'Net Cash Flow', value: summary.netCashFlow, color: summary.netCashFlow >= 0 ? '#0e6027' : '#da1e28' },
            { label: 'Avg Monthly Net', value: summary.avgMonthlyNet, color: '#0f62fe' },
          ].map(stat => (
            <Tile key={stat.label} style={{ padding: '1.25rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>{formatRM(stat.value)}</div>
              <div style={{ fontSize: '0.875rem', color: '#525252' }}>{stat.label}</div>
            </Tile>
          ))}
        </div>
      )}

      <Tile style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 600, margin: 0 }}>Income vs Expenses</h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Tag type="green">{netPositive} months positive</Tag>
            {netNegative > 0 && <Tag type="red">{netNegative} months negative</Tag>}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={data} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `RM ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Line type="monotone" dataKey="income" stroke="#0e6027" strokeWidth={2} dot={{ r: 4 }} name="Actual Income" />
            <Line type="monotone" dataKey="expenses" stroke="#da1e28" strokeWidth={2} dot={{ r: 4 }} name="Actual Expenses" />
            {data.some(d => d.projected_income > 0) && (
              <Line type="monotone" dataKey="projected_income" stroke="#6fdc8c" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected Income" />
            )}
            {data.some(d => d.projected_expenses > 0) && (
              <Line type="monotone" dataKey="projected_expenses" stroke="#ffb3b8" strokeWidth={2} strokeDasharray="5 5" dot={false} name="Projected Expenses" />
            )}
          </LineChart>
        </ResponsiveContainer>
      </Tile>

      <Tile style={{ padding: '1.5rem' }}>
        <h3 style={{ fontWeight: 600, marginBottom: '1rem' }}>Net Cash Flow by Month</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={v => `RM ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={0} stroke="#161616" />
            <Bar
              dataKey="net"
              name="Net Cash Flow"
              fill="#0f62fe"
              radius={[2, 2, 0, 0]}
              // Color bars red when negative
              label={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </Tile>
    </div>
  );
}
