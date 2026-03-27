import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOTENBERG_URL = process.env.GOTENBERG_URL || 'http://localhost:3002';

async function htmlToPdf(html) {
  const form = new FormData();
  form.append('files', new Blob([html], { type: 'text/html' }), 'index.html');

  const response = await fetch(`${GOTENBERG_URL}/forms/chromium/convert/html`, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gotenberg error ${response.status}: ${text}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

function renderTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '..', 'templates', templateName);
  let html = fs.readFileSync(templatePath, 'utf-8');

  const replace = (template, obj, prefix = '') => {
    Object.entries(obj).forEach(([key, value]) => {
      const placeholder = prefix ? `{{${prefix}.${key}}}` : `{{${key}}}`;
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        template = replace(template, value, prefix ? `${prefix}.${key}` : key);
      } else {
        template = template.split(placeholder).join(value != null ? String(value) : '');
      }
    });
    return template;
  };

  return replace(html, data);
}

function renderItemsHtml(items, currency) {
  if (!items || !Array.isArray(items)) return '';
  return items.map(item => {
    const desc = String(item.description || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
    const qty = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    const taxRate = Number(item.tax_rate || 0);
    const subtotal = qty * unitPrice;
    const taxAmt = subtotal * (taxRate / 100);
    const total = subtotal + taxAmt;
    return `<tr>
      <td>${desc}</td>
      <td style="text-align:right">${qty}</td>
      <td style="text-align:right">${currency} ${unitPrice.toFixed(2)}</td>
      <td style="text-align:right">${taxRate.toFixed(0)}%</td>
      <td style="text-align:right">${currency} ${taxAmt.toFixed(2)}</td>
      <td style="text-align:right">${currency} ${total.toFixed(2)}</td>
    </tr>`;
  }).join('\n');
}

class PdfService {
  async generateInvoicePdf(invoice, business) {
    let html = renderTemplate('invoice.html', { invoice, business });
    const itemsHtml = renderItemsHtml(invoice.items, invoice.currency || 'MYR');
    html = html.replace('<!-- Items rendered dynamically via JS or template engine -->', itemsHtml);
    return htmlToPdf(html);
  }

  async generateTaxSummaryPdf(borangBData, business) {
    const html = renderTemplate('tax-summary.html', { data: borangBData, business });
    return htmlToPdf(html);
  }

  async generateQuotationPdf(quotation, business) {
    const invoiceData = { ...quotation, invoice_number: quotation.quotation_number, type: 'QUOTATION' };
    let html = renderTemplate('invoice.html', { invoice: invoiceData, business });
    const itemsHtml = renderItemsHtml(quotation.items, quotation.currency || 'MYR');
    html = html.replace('<!-- Items rendered dynamically via JS or template engine -->', itemsHtml);
    return htmlToPdf(html);
  }

  async generateCreditNotePdf(creditNote, business) {
    const invoiceData = { ...creditNote, invoice_number: creditNote.credit_note_number, type: 'CREDIT NOTE' };
    let html = renderTemplate('invoice.html', { invoice: invoiceData, business });
    const itemsHtml = renderItemsHtml(creditNote.items, creditNote.currency || 'MYR');
    html = html.replace('<!-- Items rendered dynamically via JS or template engine -->', itemsHtml);
    return htmlToPdf(html);
  }
  async generateProfitLossPdf(report, business) {
    const fmt = (n) => `RM ${Number(n || 0).toFixed(2)}`;

    // Format numeric placeholders
    const data = {
      report: {
        period: report.period,
        totalRevenue: fmt(report.totalRevenue),
        totalCogs: fmt(report.totalCogs),
        grossProfit: fmt(report.grossProfit),
        totalOperatingExpenses: fmt(report.totalOperatingExpenses),
        netProfit: fmt(report.netProfit),
      },
      business,
    };

    let html = renderTemplate('profit-loss.html', data);

    // Render revenue items
    const revenueHtml = (report.revenue || []).map(a =>
      `<tr><td style="padding-left:24px;">${a.code} — ${a.name}</td><td>${fmt(a.amount)}</td></tr>`
    ).join('\n');
    html = html.replace('<!-- Revenue items rendered dynamically -->', revenueHtml);

    // Render COGS items
    const cogsHtml = (report.cogs || []).map(a =>
      `<tr><td style="padding-left:24px;">${a.code} — ${a.name}</td><td>${fmt(a.amount)}</td></tr>`
    ).join('\n');
    html = html.replace('<!-- COGS items rendered dynamically -->', cogsHtml);

    // Render operating expense items
    const opexHtml = (report.operatingExpenses || []).map(a =>
      `<tr><td style="padding-left:24px;">${a.code} — ${a.name}${a.borang_b_section ? ` (${a.borang_b_section})` : ''}</td><td>${fmt(a.amount)}</td></tr>`
    ).join('\n');
    html = html.replace('<!-- Operating expense items rendered dynamically -->', opexHtml);

    return htmlToPdf(html);
  }

  async generateBalanceSheetPdf(report, business) {
    const fmt = (n) => `RM ${Number(n || 0).toFixed(2)}`;

    const data = {
      report: {
        asAt: report.asAt,
        totalCurrentAssets: fmt(report.totalCurrentAssets),
        totalFixedAssets: fmt(report.totalFixedAssets),
        totalAssets: fmt(report.totalAssets),
        totalCurrentLiabilities: fmt(report.totalCurrentLiabilities),
        totalLongTermLiabilities: fmt(report.totalLongTermLiabilities),
        totalLiabilities: fmt(report.totalLiabilities),
        currentYearEarnings: fmt(report.currentYearEarnings),
        totalEquity: fmt(report.totalEquity),
        totalLiabilitiesAndEquity: fmt(report.totalLiabilitiesAndEquity),
      },
      business,
    };

    let html = renderTemplate('balance-sheet.html', data);

    const renderRows = (items) => (items || []).map(a =>
      `<tr><td style="padding-left:24px;">${a.code} — ${a.name}</td><td>${fmt(a.balance)}</td></tr>`
    ).join('\n');

    html = html.replace('<!-- Current asset items -->', renderRows(report.currentAssets));
    html = html.replace('<!-- Fixed asset items -->', renderRows(report.fixedAssets));
    html = html.replace('<!-- Current liability items -->', renderRows(report.currentLiabilities));
    html = html.replace('<!-- Long-term liability items -->', renderRows(report.longTermLiabilities));
    html = html.replace('<!-- Equity items -->', renderRows(report.equity));

    return htmlToPdf(html);
  }
}

export default new PdfService();
