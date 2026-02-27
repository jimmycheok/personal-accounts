import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { fileURLToPath } from 'url';
import path from 'path';

import { sequelize } from './config/database.js';
import { startAgenda } from './jobs/index.js';
import { errorHandler } from './middlewares/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import onboardingRoutes from './routes/onboarding.js';
import settingsRoutes from './routes/settings.js';
import customersRoutes from './routes/customers.js';
import quotationsRoutes from './routes/quotations.js';
import invoicesRoutes from './routes/invoices.js';
import creditNotesRoutes from './routes/creditNotes.js';
import paymentsRoutes from './routes/payments.js';
import expensesRoutes from './routes/expenses.js';
import expenseCategoriesRoutes from './routes/expenseCategories.js';
import einvoiceRoutes from './routes/einvoice.js';
import documentsRoutes from './routes/documents.js';
import taxationRoutes from './routes/taxation.js';
import cashFlowRoutes from './routes/cashFlow.js';
import dashboardRoutes from './routes/dashboard.js';
import bankReconciliationRoutes from './routes/bankReconciliation.js';
import mileageRoutes from './routes/mileage.js';
import exportRoutes from './routes/export.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.API_PORT || 3001;

// Security middleware
app.use(helmet({ crossOriginEmbedderPolicy: false }));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Logging
app.use(morgan('combined'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check (no auth)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
const v1 = '/api/v1';
app.use(`${v1}/auth`, authRoutes);
app.use(`${v1}/onboarding`, onboardingRoutes);
app.use(`${v1}/settings`, settingsRoutes);
app.use(`${v1}/customers`, customersRoutes);
app.use(`${v1}/quotations`, quotationsRoutes);
app.use(`${v1}/invoices`, invoicesRoutes);
app.use(`${v1}/credit-notes`, creditNotesRoutes);
app.use(`${v1}/invoices/:invoiceId/payments`, paymentsRoutes); // nested: /invoices/:invoiceId/payments
app.use(`${v1}/expenses`, expensesRoutes);
app.use(`${v1}/expense-categories`, expenseCategoriesRoutes);
app.use(`${v1}/einvoice`, einvoiceRoutes);
app.use(`${v1}/documents`, documentsRoutes);
app.use(`${v1}/taxation`, taxationRoutes);
app.use(`${v1}/cash-flow`, cashFlowRoutes);
app.use(`${v1}/dashboard`, dashboardRoutes);
app.use(`${v1}/bank-reconciliation`, bankReconciliationRoutes);
app.use(`${v1}/mileage`, mileageRoutes);
app.use(`${v1}/export`, exportRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use(errorHandler);

// Bootstrap
async function bootstrap() {
  try {
    await sequelize.authenticate();
    console.log('✓ PostgreSQL connected');

    await startAgenda();
    console.log('✓ Agenda (MongoDB) started');

    app.listen(PORT, () => {
      console.log(`✓ API server running on http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Bootstrap error:', err);
    process.exit(1);
  }
}

bootstrap();

export default app;
