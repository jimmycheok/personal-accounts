import nodemailer from 'nodemailer';
import { Invoice, Customer } from '../models/index.js';
import { Op } from 'sequelize';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export function definePaymentRemindersJob(agenda) {
  agenda.define('send-payment-reminders', async (job) => {
    const today = new Date();
    const reminderDays = [3, 7, 14];

    let sent = 0;

    for (const days of reminderDays) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() - days);
      const targetDateStr = targetDate.toISOString().split('T')[0];

      const overdueInvoices = await Invoice.findAll({
        where: {
          status: 'overdue',
          due_date: targetDateStr,
        },
        include: [{ model: Customer, as: 'customer' }],
      });

      for (const invoice of overdueInvoices) {
        if (!invoice.customer?.email) continue;

        try {
          await transporter.sendMail({
            from: process.env.EMAIL_FROM || 'noreply@business.com',
            to: invoice.customer.email,
            subject: `Payment Reminder: Invoice ${invoice.invoice_number} (${days} days overdue)`,
            html: `
              <p>Dear ${invoice.customer.name},</p>
              <p>This is a reminder that Invoice <strong>${invoice.invoice_number}</strong> 
              for <strong>MYR ${parseFloat(invoice.amount_due).toFixed(2)}</strong> 
              was due on ${invoice.due_date} and is now ${days} days overdue.</p>
              <p>Please arrange payment at your earliest convenience.</p>
              <p>Thank you.</p>
            `,
          });
          sent++;
        } catch (err) {
          console.error(`[payment-reminders] Email error for invoice ${invoice.invoice_number}:`, err.message);
        }
      }
    }

    console.log(`[send-payment-reminders] Sent ${sent} reminder emails`);
  });
}
