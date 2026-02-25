import { Chromiumly, HtmlConverter } from 'chromiumly';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

Chromiumly.configure({ endpoint: process.env.GOTENBERG_URL || 'http://localhost:3002' });

function renderTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '..', 'templates', templateName);
  let html = fs.readFileSync(templatePath, 'utf-8');

  // Simple template replacement
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
    const converter = new HtmlConverter();
    const buffer = await converter.convert({ html, printBackground: true });
    return buffer;
  }

  async generateTaxSummaryPdf(borangBData, business) {
    const html = renderTemplate('tax-summary.html', { data: borangBData, business });
    const converter = new HtmlConverter();
    const buffer = await converter.convert({ html, printBackground: true });
    return buffer;
  }

  async generateQuotationPdf(quotation, business) {
    const html = renderTemplate('invoice.html', {
      invoice: { ...quotation, invoice_number: quotation.quotation_number, type: 'QUOTATION' },
      business,
    });
    const converter = new HtmlConverter();
    return converter.convert({ html, printBackground: true });
  }
}

export default new PdfService();
