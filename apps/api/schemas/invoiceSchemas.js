import { z } from 'zod';

export const InvoiceItemSchema = z.object({
  description: z.string().min(1, 'Description is required'),
  quantity: z.coerce.number().positive().default(1),
  unit_price: z.coerce.number().nonnegative(),
  tax_rate: z.coerce.number().min(0).max(100).default(0),
  discount_rate: z.coerce.number().min(0).max(100).default(0),
  classification_code: z.string().optional(),
  sort_order: z.coerce.number().default(0),
});

export const CreateInvoiceSchema = z.object({
  customer_id: z.coerce.number().int().positive(),
  quotation_id: z.coerce.number().int().positive().optional(),
  invoice_number: z.string().optional(),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  currency: z.string().length(3).default('MYR'),
  exchange_rate: z.coerce.number().positive().default(1),
  notes: z.string().optional(),
  terms: z.string().optional(),
  items: z.array(InvoiceItemSchema).min(1, 'At least one item required'),
});

export const UpdateInvoiceSchema = CreateInvoiceSchema.partial();

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  tin: z.string().optional(),
  id_type: z.enum(['NRIC', 'BRN', 'Passport', 'Army']).default('BRN'),
  id_value: z.string().optional(),
  customer_type: z.enum(['B2B', 'B2C', 'B2G']).default('B2B'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  postcode: z.string().optional(),
  state: z.string().optional(),
  country: z.string().default('Malaysia'),
  notes: z.string().optional(),
});

export const CreateExpenseSchema = z.object({
  vendor_name: z.string().min(1).max(200),
  description: z.string().optional(),
  amount: z.coerce.number().positive(),
  currency: z.string().length(3).default('MYR'),
  exchange_rate: z.coerce.number().positive().default(1),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  category_id: z.coerce.number().int().positive().optional(),
  is_tax_deductible: z.boolean().default(true),
  notes: z.string().optional(),
  receipt_path: z.string().optional(),
});

export const CreateMileageLogSchema = z.object({
  log_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from_location: z.string().optional(),
  to_location: z.string().optional(),
  purpose: z.string().min(1),
  km: z.coerce.number().positive(),
  rate_per_km: z.coerce.number().positive().default(0.25),
  tax_year: z.coerce.number().int().optional(),
  notes: z.string().optional(),
});

export const LoginSchema = z.object({
  password: z.string().min(1),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});
