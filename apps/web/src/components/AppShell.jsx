import React, { useState } from 'react';
import {
  Header,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  SideNav,
  SideNavItems,
  SideNavLink,
  Content,
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
} from '@carbon/icons-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AppShell({ children }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname.startsWith(path);

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: Dashboard },
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
          Personal Accountant
        </HeaderName>
        <HeaderNavigation aria-label="main navigation">
          <HeaderMenuItem onClick={logout}>
            <Logout size={16} style={{ marginRight: '0.5rem' }} />
            Logout
          </HeaderMenuItem>
        </HeaderNavigation>
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
    </div>
  );
}
