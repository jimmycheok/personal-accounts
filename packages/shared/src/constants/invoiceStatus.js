// Invoice lifecycle statuses
export const INVOICE_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  CANCELLED: 'cancelled',
  VOID: 'void',
};

// Quotation statuses
export const QUOTATION_STATUS = {
  DRAFT: 'draft',
  SENT: 'sent',
  ACCEPTED: 'accepted',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
};

// Credit note statuses
export const CREDIT_NOTE_STATUS = {
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  VALID: 'valid',
  CANCELLED: 'cancelled',
};

// E-invoice submission statuses
export const EINVOICE_STATUS = {
  PENDING: 'pending',
  VALID: 'valid',
  INVALID: 'invalid',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
};

// E-invoice document types (LHDN)
export const EINVOICE_TYPE = {
  INVOICE: '01',
  CREDIT_NOTE: '02',
  DEBIT_NOTE: '03',
  SELF_BILLED_INVOICE: '11',
  SELF_BILLED_CREDIT_NOTE: '12',
  SELF_BILLED_DEBIT_NOTE: '13',
  CONSOLIDATED: '01', // consolidated uses invoice type
};

// Payment methods
export const PAYMENT_METHOD = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  DUITNOW: 'duitnow',
  CHEQUE: 'cheque',
  CREDIT_CARD: 'credit_card',
  ONLINE_BANKING: 'online_banking',
  OTHER: 'other',
};

// Customer types
export const CUSTOMER_TYPE = {
  B2B: 'B2B',
  B2C: 'B2C',
  B2G: 'B2G',
};

// ID types for TIN validation
export const ID_TYPE = {
  NRIC: 'NRIC',
  BRN: 'BRN',
  PASSPORT: 'Passport',
  ARMY: 'Army',
};

// Storage types
export const STORAGE_TYPE = {
  LOCAL: 'local',
  GOOGLE_DRIVE: 'google_drive',
  AWS_S3: 'aws_s3',
};

// Recurring template types
export const RECURRING_TYPE = {
  INVOICE: 'invoice',
  EXPENSE: 'expense',
};

// Recurring frequencies
export const RECURRING_FREQUENCY = {
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  QUARTERLY: 'quarterly',
  ANNUALLY: 'annually',
};
