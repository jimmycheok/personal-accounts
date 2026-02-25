import { Sequelize } from 'sequelize';
import { sequelize } from '../config/database.js';

// Import all models
import BusinessProfile from './BusinessProfile.js';
import EinvoiceConfig from './EinvoiceConfig.js';
import StorageConfig from './StorageConfig.js';
import Customer from './Customer.js';
import Quotation from './Quotation.js';
import QuotationItem from './QuotationItem.js';
import Invoice from './Invoice.js';
import InvoiceItem from './InvoiceItem.js';
import Payment from './Payment.js';
import CreditNote from './CreditNote.js';
import EinvoiceSubmission from './EinvoiceSubmission.js';
import ConsolidatedSubmission from './ConsolidatedSubmission.js';
import ExpenseCategory from './ExpenseCategory.js';
import Expense from './Expense.js';
import Document from './Document.js';
import RecurringTemplate from './RecurringTemplate.js';
import BankStatement from './BankStatement.js';
import BankStatementRow from './BankStatementRow.js';
import MileageLog from './MileageLog.js';
import AuditLog from './AuditLog.js';
import CashFlowProjection from './CashFlowProjection.js';

// Associations
Quotation.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Quotation, { foreignKey: 'customer_id', as: 'quotations' });

QuotationItem.belongsTo(Quotation, { foreignKey: 'quotation_id', as: 'quotation' });
Quotation.hasMany(QuotationItem, { foreignKey: 'quotation_id', as: 'items' });

Invoice.belongsTo(Customer, { foreignKey: 'customer_id', as: 'customer' });
Customer.hasMany(Invoice, { foreignKey: 'customer_id', as: 'invoices' });

Invoice.belongsTo(Quotation, { foreignKey: 'quotation_id', as: 'quotation' });
Quotation.hasOne(Invoice, { foreignKey: 'quotation_id', as: 'invoice' });

InvoiceItem.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
Invoice.hasMany(InvoiceItem, { foreignKey: 'invoice_id', as: 'items' });

Payment.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
Invoice.hasMany(Payment, { foreignKey: 'invoice_id', as: 'payments' });

CreditNote.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
Invoice.hasMany(CreditNote, { foreignKey: 'invoice_id', as: 'creditNotes' });

EinvoiceSubmission.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
EinvoiceSubmission.belongsTo(CreditNote, { foreignKey: 'credit_note_id', as: 'creditNote' });
Invoice.hasMany(EinvoiceSubmission, { foreignKey: 'invoice_id', as: 'einvoiceSubmissions' });

Expense.belongsTo(ExpenseCategory, { foreignKey: 'category_id', as: 'category' });
ExpenseCategory.hasMany(Expense, { foreignKey: 'category_id', as: 'expenses' });
ExpenseCategory.belongsTo(ExpenseCategory, { foreignKey: 'parent_id', as: 'parent' });
ExpenseCategory.hasMany(ExpenseCategory, { foreignKey: 'parent_id', as: 'children' });

BankStatementRow.belongsTo(BankStatement, { foreignKey: 'bank_statement_id', as: 'statement' });
BankStatement.hasMany(BankStatementRow, { foreignKey: 'bank_statement_id', as: 'rows' });

export {
  sequelize,
  Sequelize,
  BusinessProfile,
  EinvoiceConfig,
  StorageConfig,
  Customer,
  Quotation,
  QuotationItem,
  Invoice,
  InvoiceItem,
  Payment,
  CreditNote,
  EinvoiceSubmission,
  ConsolidatedSubmission,
  ExpenseCategory,
  Expense,
  Document,
  RecurringTemplate,
  BankStatement,
  BankStatementRow,
  MileageLog,
  AuditLog,
  CashFlowProjection,
};
