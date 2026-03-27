import React from 'react';
import { Tile } from '@carbon/react';
import { useNavigate } from 'react-router-dom';

const reports = [
  { title: 'Profit & Loss', description: 'Revenue, expenses, and net profit for a period', path: '/reports/profit-loss', color: '#0f62fe' },
  { title: 'Balance Sheet', description: 'Assets, liabilities, and equity as at a date', path: '/reports/balance-sheet', color: '#0e6027' },
];

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <h1 className="page-title">Financial Reports</h1>
      <div className="grid-2">
        {reports.map(r => (
          <Tile
            key={r.path}
            onClick={() => navigate(r.path)}
            style={{ padding: '2rem', cursor: 'pointer', borderLeft: `4px solid ${r.color}`, transition: 'background 0.15s' }}
          >
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: r.color, marginBottom: '0.5rem' }}>{r.title}</h3>
            <p style={{ color: '#525252' }}>{r.description}</p>
          </Tile>
        ))}
      </div>
    </div>
  );
}
