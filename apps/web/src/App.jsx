import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { AppSettingsProvider } from './context/AppSettingsContext.jsx';
import AppShell from './components/AppShell.jsx';

// Pages
import LoginPage from './pages/Login/index.jsx';
import OnboardingPage from './pages/Onboarding/index.jsx';
import DashboardPage from './pages/Dashboard/index.jsx';
import InvoicesListPage from './pages/Invoices/index.jsx';
import InvoiceFormPage from './pages/Invoices/InvoiceForm.jsx';
import InvoiceDetailPage from './pages/Invoices/InvoiceDetail.jsx';
import QuotationsPage from './pages/Quotations/index.jsx';
import QuotationFormPage from './pages/Quotations/QuotationForm.jsx';
import QuotationDetailPage from './pages/Quotations/QuotationDetail.jsx';
import ExpensesPage from './pages/Expenses/index.jsx';
import CreditNotesPage from './pages/CreditNotes/index.jsx';
import CreditNoteDetailPage from './pages/CreditNotes/CreditNoteDetail.jsx';
import TaxationPage from './pages/Taxation/index.jsx';
import CashFlowPage from './pages/CashFlow/index.jsx';
import BankReconciliationPage from './pages/BankReconciliation/index.jsx';
import MileagePage from './pages/Mileage/index.jsx';
import DocumentsPage from './pages/Documents/index.jsx';
import SettingsPage from './pages/Settings/index.jsx';
import CustomersPage from './pages/Customers/index.jsx';
import ChartOfAccountsPage from './pages/ChartOfAccounts/index.jsx';
import AccountLedgerPage from './pages/ChartOfAccounts/AccountLedger.jsx';
import GeneralLedgerPage from './pages/GeneralLedger/index.jsx';
import JournalEntryDetailPage from './pages/GeneralLedger/JournalEntryDetail.jsx';
import JournalEntryFormPage from './pages/GeneralLedger/JournalEntryForm.jsx';
import ReportsPage from './pages/Reports/index.jsx';
import ProfitLossPage from './pages/Reports/ProfitLoss.jsx';
import BalanceSheetPage from './pages/Reports/BalanceSheet.jsx';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div>Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/onboarding" element={<PrivateRoute><OnboardingPage /></PrivateRoute>} />
      <Route path="/*" element={
        <PrivateRoute>
          <AppShell>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/customers" element={<CustomersPage />} />
              <Route path="/invoices" element={<InvoicesListPage />} />
              <Route path="/invoices/new" element={<InvoiceFormPage />} />
              <Route path="/invoices/:id/edit" element={<InvoiceFormPage />} />
              <Route path="/invoices/:id" element={<InvoiceDetailPage />} />
              <Route path="/quotations" element={<QuotationsPage />} />
              <Route path="/quotations/new" element={<QuotationFormPage />} />
              <Route path="/quotations/:id/edit" element={<QuotationFormPage />} />
              <Route path="/quotations/:id" element={<QuotationDetailPage />} />
              <Route path="/credit-notes" element={<CreditNotesPage />} />
              <Route path="/credit-notes/:id" element={<CreditNoteDetailPage />} />
              <Route path="/expenses" element={<ExpensesPage />} />
              <Route path="/taxation" element={<TaxationPage />} />
              <Route path="/cash-flow" element={<CashFlowPage />} />
              <Route path="/bank-reconciliation" element={<BankReconciliationPage />} />
              <Route path="/mileage" element={<MileagePage />} />
              <Route path="/chart-of-accounts" element={<ChartOfAccountsPage />} />
              <Route path="/chart-of-accounts/:id/ledger" element={<AccountLedgerPage />} />
              <Route path="/general-ledger" element={<GeneralLedgerPage />} />
              <Route path="/general-ledger/new" element={<JournalEntryFormPage />} />
              <Route path="/general-ledger/:id" element={<JournalEntryDetailPage />} />
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/reports/profit-loss" element={<ProfitLossPage />} />
              <Route path="/reports/balance-sheet" element={<BalanceSheetPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </AppShell>
        </PrivateRoute>
      } />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppSettingsProvider>
          <AppRoutes />
        </AppSettingsProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
