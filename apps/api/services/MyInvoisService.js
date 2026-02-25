import axios from 'axios';
import crypto from 'crypto';
import { EinvoiceConfig, Invoice, CreditNote, EinvoiceSubmission, BusinessProfile } from '../models/index.js';

const SANDBOX_URL = process.env.MYINVOIS_SANDBOX_URL || 'https://preprod-api.myinvois.hasil.gov.my';
const PROD_URL = process.env.MYINVOIS_PROD_URL || 'https://api.myinvois.hasil.gov.my';
const AES_KEY = process.env.AES_SECRET_KEY || '0123456789abcdef0123456789abcdef';

function decrypt(encryptedText) {
  const [ivHex, encrypted] = encryptedText.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const key = Buffer.from(AES_KEY.padEnd(32).slice(0, 32));
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function encrypt(text) {
  const key = Buffer.from(AES_KEY.padEnd(32).slice(0, 32));
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return `${iv.toString('hex')}:${encrypted}`;
}

class MyInvoisService {
  async getConfig() {
    const config = await EinvoiceConfig.findOne({ order: [['id', 'DESC']] });
    if (!config) throw new Error('E-invoice not configured');
    return config;
  }

  getBaseUrl(isSandbox) {
    return isSandbox ? SANDBOX_URL : PROD_URL;
  }

  async getAccessToken(forceRefresh = false) {
    const config = await this.getConfig();
    const now = new Date();
    const expiresAt = config.token_expires_at ? new Date(config.token_expires_at) : null;

    // Use cached token if valid (and not expiring in < 5 min)
    if (!forceRefresh && expiresAt && (expiresAt - now) > 5 * 60 * 1000 && config.cached_token) {
      return config.cached_token;
    }

    const clientSecret = decrypt(config.client_secret_enc);
    const baseUrl = this.getBaseUrl(config.is_sandbox);

    const response = await axios.post(
      `${baseUrl}/connect/token`,
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: config.client_id,
        client_secret: clientSecret,
        scope: 'InvoicingAPI',
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const { access_token, expires_in } = response.data;
    const tokenExpiry = new Date(now.getTime() + expires_in * 1000);

    await config.update({
      cached_token: access_token,
      token_expires_at: tokenExpiry,
    });

    return access_token;
  }

  async apiRequest(method, path, data = null) {
    const config = await this.getConfig();
    const token = await this.getAccessToken();
    const baseUrl = this.getBaseUrl(config.is_sandbox);

    const response = await axios({
      method,
      url: `${baseUrl}${path}`,
      data,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  }

  buildUBLDocument(invoice, business, type = '01') {
    const items = invoice.items || [];
    const lines = items.map((item, idx) => ({
      ID: String(idx + 1),
      InvoicedQuantity: {
        _: parseFloat(item.quantity),
        unitCode: 'C62',
      },
      LineExtensionAmount: {
        _: parseFloat(item.subtotal),
        currencyID: invoice.currency || 'MYR',
      },
      TaxTotal: [{
        TaxAmount: {
          _: parseFloat(item.tax_amount || 0),
          currencyID: invoice.currency || 'MYR',
        },
        TaxSubtotal: [{
          TaxableAmount: { _: parseFloat(item.subtotal), currencyID: invoice.currency || 'MYR' },
          TaxAmount: { _: parseFloat(item.tax_amount || 0), currencyID: invoice.currency || 'MYR' },
          TaxCategory: {
            ID: { _: item.tax_rate > 0 ? '01' : 'E' },
            TaxScheme: { ID: { _: 'OTH', schemeID: 'UN/ECE 5153', schemeAgencyID: '6' } },
          },
        }],
      }],
      Item: {
        CommodityClassification: [{
          ItemClassificationCode: {
            _: item.classification_code || '004',
            listID: 'CLASS',
          },
        }],
        Description: [{ _: item.description }],
      },
      Price: {
        PriceAmount: {
          _: parseFloat(item.unit_price),
          currencyID: invoice.currency || 'MYR',
        },
      },
    }));

    return {
      _D: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
      _A: 'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
      _B: 'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
      Invoice: [{
        ID: [{ _: invoice.invoice_number }],
        IssueDate: [{ _: invoice.issue_date }],
        IssueTime: [{ _: '00:00:00' }],
        InvoiceTypeCode: [{ _: type, listVersionID: '1.0' }],
        DocumentCurrencyCode: [{ _: invoice.currency || 'MYR' }],
        TaxCurrencyCode: [{ _: 'MYR' }],
        AccountingSupplierParty: [{
          Party: [{
            PartyLegalEntity: [{ RegistrationName: [{ _: business.business_name }] }],
            PostalAddress: [{
              AddressLine: [{ Line: [{ _: business.address_line1 || '' }] }],
              CityName: [{ _: business.city || '' }],
              PostalZone: [{ _: business.postcode || '' }],
              Country: [{ IdentificationCode: [{ _: 'MYS' }] }],
            }],
            PartyIdentification: [
              { ID: [{ _: business.tin, schemeID: 'TIN' }] },
              { ID: [{ _: business.ssm_number || '', schemeID: 'BRN' }] },
            ],
            Contact: [{ ElectronicMail: [{ _: business.email || '' }] }],
          }],
        }],
        AccountingCustomerParty: [{
          Party: [{
            PartyLegalEntity: [{ RegistrationName: [{ _: invoice.customer?.name || '' }] }],
            PostalAddress: [{
              AddressLine: [{ Line: [{ _: invoice.customer?.address_line1 || 'N/A' }] }],
              CityName: [{ _: invoice.customer?.city || '' }],
              PostalZone: [{ _: invoice.customer?.postcode || '' }],
              Country: [{ IdentificationCode: [{ _: 'MYS' }] }],
            }],
            PartyIdentification: [
              { ID: [{ _: invoice.customer?.tin || '', schemeID: 'TIN' }] },
              { ID: [{ _: invoice.customer?.id_value || '', schemeID: invoice.customer?.id_type || 'BRN' }] },
            ],
          }],
        }],
        Delivery: [{ ActualDeliveryDate: [{ _: invoice.issue_date }] }],
        PaymentMeans: [{
          PaymentMeansCode: [{ _: '30' }],
          PayeeFinancialAccount: [{
            ID: [{ _: business.bank_account_number || '' }],
          }],
        }],
        TaxTotal: [{
          TaxAmount: [{ _: parseFloat(invoice.tax_total || 0), currencyID: 'MYR' }],
          TaxSubtotal: [{
            TaxableAmount: { _: parseFloat(invoice.subtotal || 0), currencyID: 'MYR' },
            TaxAmount: { _: parseFloat(invoice.tax_total || 0), currencyID: 'MYR' },
            TaxCategory: {
              ID: { _: invoice.tax_total > 0 ? '01' : 'E' },
              TaxScheme: { ID: { _: 'OTH', schemeID: 'UN/ECE 5153', schemeAgencyID: '6' } },
            },
          }],
        }],
        LegalMonetaryTotal: [{
          LineExtensionAmount: [{ _: parseFloat(invoice.subtotal || 0), currencyID: invoice.currency || 'MYR' }],
          TaxExclusiveAmount: [{ _: parseFloat(invoice.subtotal || 0), currencyID: invoice.currency || 'MYR' }],
          TaxInclusiveAmount: [{ _: parseFloat(invoice.total || 0), currencyID: invoice.currency || 'MYR' }],
          PayableAmount: [{ _: parseFloat(invoice.amount_due || invoice.total || 0), currencyID: invoice.currency || 'MYR' }],
        }],
        InvoiceLine: lines,
      }],
    };
  }

  async submitDocument(invoiceId) {
    const invoice = await Invoice.findByPk(invoiceId, {
      include: ['customer', 'items'],
    });
    if (!invoice) throw new Error('Invoice not found');

    const business = await BusinessProfile.findOne();
    if (!business) throw new Error('Business profile not configured');

    const ublDoc = this.buildUBLDocument(invoice, business);
    const docJson = JSON.stringify(ublDoc);
    const docBase64 = Buffer.from(docJson).toString('base64');
    const hash = crypto.createHash('sha256').update(docJson).digest('hex');

    const submission = await EinvoiceSubmission.create({
      invoice_id: invoiceId,
      submission_type: 'invoice',
      status: 'pending',
      submitted_at: new Date(),
    });

    try {
      const response = await this.apiRequest('POST', '/api/v1.0/documentsubmissions', {
        documents: [{
          format: 'JSON',
          documentHash: hash,
          codeNumber: invoice.invoice_number,
          document: docBase64,
        }],
      });

      const accepted = response.acceptedDocuments?.[0];
      await submission.update({
        submission_uid: response.submissionUID,
        document_uid: accepted?.uuid,
        lhdn_response_raw: response,
        status: accepted ? 'pending' : 'invalid',
      });

      if (accepted) {
        await this.pollStatus(submission.id);
      }

      return submission;
    } catch (err) {
      await submission.update({
        status: 'invalid',
        error_message: err.response?.data?.message || err.message,
        lhdn_response_raw: err.response?.data,
      });
      throw err;
    }
  }

  async pollStatus(submissionId) {
    const submission = await EinvoiceSubmission.findByPk(submissionId);
    if (!submission?.document_uid) return submission;

    try {
      const response = await this.apiRequest('GET', `/api/v1.0/documents/${submission.document_uid}/details`);

      const updates = {
        lhdn_response_raw: response,
        status: response.status?.toLowerCase() || 'pending',
      };

      if (response.status === 'Valid') {
        updates.validated_at = new Date();
        updates.long_id = response.longId;

        // Update invoice with long_id for QR
        if (submission.invoice_id) {
          await Invoice.update({ einvoice_long_id: response.longId }, { where: { id: submission.invoice_id } });
        }
      }

      await submission.update(updates);
      return submission;
    } catch (err) {
      console.error('Poll status error:', err.message);
      return submission;
    }
  }

  async cancelDocument(submissionId, reason = 'Cancelled by user') {
    const submission = await EinvoiceSubmission.findByPk(submissionId);
    if (!submission?.document_uid) throw new Error('No document UID for cancellation');

    await this.apiRequest('PUT', `/api/v1.0/documents/state/${submission.document_uid}/state`, {
      status: 'cancelled',
      reason,
    });

    await submission.update({ status: 'cancelled', cancelled_at: new Date() });
    return submission;
  }

  async validateTin(tin, idType, idValue) {
    const response = await this.apiRequest('GET', `/api/v1.0/taxpayer/validate/${tin}?idType=${idType}&idValue=${idValue}`);
    return response;
  }

  async submitCreditNote(creditNoteId) {
    const creditNote = await CreditNote.findByPk(creditNoteId, {
      include: [{ association: 'invoice', include: ['customer', 'items'] }],
    });
    if (!creditNote) throw new Error('Credit note not found');

    const business = await BusinessProfile.findOne();
    const ublDoc = this.buildUBLDocument(creditNote.invoice, business, '02');
    // Adjust for credit note specifics
    ublDoc.Invoice[0].ID[0]._ = creditNote.credit_note_number;
    ublDoc.Invoice[0].BillingReference = [{
      InvoiceDocumentReference: [{
        ID: [{ _: creditNote.invoice.invoice_number }],
      }],
    }];

    const docJson = JSON.stringify(ublDoc);
    const docBase64 = Buffer.from(docJson).toString('base64');
    const hash = crypto.createHash('sha256').update(docJson).digest('hex');

    const submission = await EinvoiceSubmission.create({
      credit_note_id: creditNoteId,
      invoice_id: creditNote.invoice_id,
      submission_type: 'credit_note',
      status: 'pending',
      submitted_at: new Date(),
    });

    const response = await this.apiRequest('POST', '/api/v1.0/documentsubmissions', {
      documents: [{
        format: 'JSON',
        documentHash: hash,
        codeNumber: creditNote.credit_note_number,
        document: docBase64,
      }],
    });

    const accepted = response.acceptedDocuments?.[0];
    await submission.update({
      submission_uid: response.submissionUID,
      document_uid: accepted?.uuid,
      lhdn_response_raw: response,
    });

    return submission;
  }

  async submitConsolidated(period, transactions) {
    const business = await BusinessProfile.findOne();
    const totalAmount = transactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const ublDoc = {
      ...this.buildUBLDocument({
        invoice_number: `CONS-${period}`,
        issue_date: new Date().toISOString().split('T')[0],
        currency: 'MYR',
        subtotal: totalAmount,
        tax_total: 0,
        total: totalAmount,
        amount_due: totalAmount,
        customer: { name: 'Consolidated B2C', tin: 'EI00000000010', id_type: 'BRN', id_value: 'NA' },
        items: [{ description: `Consolidated B2C transactions ${period}`, quantity: 1, unit_price: totalAmount, tax_rate: 0, subtotal: totalAmount, tax_amount: 0, total: totalAmount, classification_code: '004' }],
      }, business, '01'),
    };

    const docJson = JSON.stringify(ublDoc);
    const docBase64 = Buffer.from(docJson).toString('base64');
    const hash = crypto.createHash('sha256').update(docJson).digest('hex');

    const response = await this.apiRequest('POST', '/api/v1.0/documentsubmissions', {
      documents: [{
        format: 'JSON',
        documentHash: hash,
        codeNumber: `CONS-${period}`,
        document: docBase64,
      }],
    });

    return response;
  }

  encryptSecret(plaintext) {
    return encrypt(plaintext);
  }
}

export default new MyInvoisService();
