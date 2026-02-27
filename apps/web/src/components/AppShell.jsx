import React, { useState } from 'react';
import logo from '../assets/logo.svg';
import {
  Header,
  HeaderName,
  HeaderGlobalBar,
  HeaderGlobalAction,
  SideNav,
  SideNavItems,
  SideNavLink,
} from '@carbon/react';
import {
  Dashboard,
  Receipt,
  DocumentMultiple_01,
  Currency,
  ChartLine,
  PiggyBank,
  CarFront,
  Folder,
  Settings,
  Logout,
  Document,
  UserMultiple,
  Bot,
} from '@carbon/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import OCRAssistantModal from './OCRAssistantModal.jsx';
import AddExpenseModal from './AddExpenseModal.jsx';

export default function AppShell({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [ocrOpen, setOcrOpen] = useState(false);
  const [addExpenseOpen, setAddExpenseOpen] = useState(false);
  const [expensePrefill, setExpensePrefill] = useState(null);

  const isActive = (path) => location.pathname.startsWith(path);

  const handleOcrExtracted = (data) => {
    setExpensePrefill(data);
    setOcrOpen(false);
    setAddExpenseOpen(true);
  };

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Dashboard },
    { label: 'Customers', path: '/customers', icon: UserMultiple },
    { label: 'Invoices', path: '/invoices', icon: Receipt },
    { label: 'Quotations', path: '/quotations', icon: Document },
    { label: 'Credit Notes', path: '/credit-notes', icon: DocumentMultiple_01 },
    { label: 'Expenses', path: '/expenses', icon: Currency },
    { label: 'Taxation', path: '/taxation', icon: DocumentMultiple_01 },
    { label: 'Cash Flow', path: '/cash-flow', icon: ChartLine },
    { label: 'Bank Recon', path: '/bank-reconciliation', icon: PiggyBank },
    { label: 'Mileage', path: '/mileage', icon: CarFront },
    { label: 'Documents', path: '/documents', icon: Folder },
    { label: 'Settings', path: '/settings', icon: Settings },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <Header aria-label="Personal Accountant">
        <HeaderName href="/" prefix="">
          <img src={logo} alt="" width="24" height="24" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Personal Accountant
        </HeaderName>
        <HeaderGlobalBar>
          <HeaderGlobalAction
            aria-label="AI Receipt Assistant"
            tooltipAlignment="end"
            onClick={() => setOcrOpen(true)}
          >
            <Bot size={20} />
          </HeaderGlobalAction>
          <HeaderGlobalAction
            aria-label="Logout"
            tooltipAlignment="end"
            onClick={logout}
          >
            <Logout size={20} />
          </HeaderGlobalAction>
        </HeaderGlobalBar>
      </Header>

      <div style={{ display: 'flex', flex: 1, marginTop: '3rem' }}>
        <SideNav
          aria-label="Side navigation"
          expanded={true}
          isFixedNav
          href="#main-content"
        >
          <SideNavItems>
            {navItems.map(item => (
              <SideNavLink
                key={item.path}
                renderIcon={item.icon}
                isActive={isActive(item.path)}
                href={item.path}
                onClick={(e) => { e.preventDefault(); navigate(item.path); }}
              >
                {item.label}
              </SideNavLink>
            ))}
          </SideNavItems>
        </SideNav>

        <main
          id="main-content"
          style={{
            marginLeft: '16rem',
            flex: 1,
            padding: '2rem',
            backgroundColor: '#f4f4f4',
            minHeight: 'calc(100vh - 3rem)',
          }}
        >
          {children}
        </main>
      </div>

      <OCRAssistantModal
        open={ocrOpen}
        onClose={() => setOcrOpen(false)}
        onExtracted={handleOcrExtracted}
      />
      <AddExpenseModal
        open={addExpenseOpen}
        onClose={() => { setAddExpenseOpen(false); setExpensePrefill(null); }}
        prefill={expensePrefill}
        onSuccess={() => {
          setAddExpenseOpen(false);
          setExpensePrefill(null);
          // If already on expenses page, list will refresh on next visit;
          // a reload here would disrupt navigation, so skip it.
        }}
      />
    </div>
  );
}
