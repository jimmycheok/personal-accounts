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

class PdfService {
  async generateInvoicePdf(invoice, business) {
    const html = renderTemplate('invoice.html', { invoice, business });
    return htmlToPdf(html);
  }

  async generateTaxSummaryPdf(borangBData, business) {
    const html = renderTemplate('tax-summary.html', { data: borangBData, business });
    return htmlToPdf(html);
  }

  async generateQuotationPdf(quotation, business) {
    const html = renderTemplate('invoice.html', {
      invoice: { ...quotation, invoice_number: quotation.quotation_number, type: 'QUOTATION' },
      business,
    });
    return htmlToPdf(html);
  }

  async generateCreditNotePdf(creditNote, business) {
    const html = renderTemplate('invoice.html', {
      invoice: { ...creditNote, invoice_number: creditNote.credit_note_number, type: 'CREDIT NOTE' },
      business,
    });
    return htmlToPdf(html);
  }
}

export default new PdfService();
