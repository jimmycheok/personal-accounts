import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { BusinessProfile, EinvoiceConfig } from '../models/index.js';
import MyInvoisService from '../services/MyInvoisService.js';
import StorageService from '../services/StorageService.js';

const router = Router();
router.use(verifyJwt);

// Map DB field names to frontend field names
function profileToFrontend(profile) {
  if (!profile) return {};
  const data = profile.toJSON ? profile.toJSON() : profile;
  return {
    business_name: data.business_name || '',
    registration_number: data.ssm_number || '',
    tax_identification_number: data.tin || '',
    sst_number: data.sst_number || '',
    address_line1: data.address_line1 || '',
    address_line2: data.address_line2 || '',
    city: data.city || '',
    postcode: data.postcode || '',
    state: data.state || '',
    country: data.country || 'Malaysia',
    phone: data.phone || '',
    email: data.email || '',
    website: data.website || '',
    currency: data.default_currency || 'MYR',
    fiscal_year_start: data.preferences?.fiscal_year_start || '01',
    invoice_prefix: data.invoice_prefix || 'INV-',
    quotation_prefix: data.quotation_prefix || 'QT-',
    invoice_notes: data.preferences?.invoice_notes || '',
  };
}

// Map frontend field names to DB field names
function frontendToProfile(body) {
  const dbFields = {
    business_name: body.business_name,
    ssm_number: body.registration_number,
    tin: body.tax_identification_number,
    sst_number: body.sst_number,
    address_line1: body.address_line1,
    address_line2: body.address_line2,
    city: body.city,
    postcode: body.postcode,
    state: body.state,
    country: body.country,
    phone: body.phone,
    email: body.email,
    website: body.website,
    default_currency: body.currency,
    invoice_prefix: body.invoice_prefix,
    quotation_prefix: body.quotation_prefix,
  };
  // Store fields without dedicated columns in preferences
  const prefFields = {};
  if (body.fiscal_year_start !== undefined) prefFields.fiscal_year_start = body.fiscal_year_start;
  if (body.invoice_notes !== undefined) prefFields.invoice_notes = body.invoice_notes;
  return { dbFields, prefFields };
}

router.get('/business-profile', async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findOne();
    res.json(profileToFrontend(profile));
  } catch (err) { next(err); }
});

router.put('/business-profile', async (req, res, next) => {
  try {
    const { dbFields, prefFields } = frontendToProfile(req.body);
    let profile = await BusinessProfile.findOne();
    if (profile) {
      const { password_hash, ...existingPrefs } = profile.preferences || {};
      dbFields.preferences = { ...existingPrefs, password_hash, ...prefFields };
      await profile.update(dbFields);
    } else {
      dbFields.preferences = prefFields;
      profile = await BusinessProfile.create(dbFields);
    }
    res.json(profileToFrontend(profile));
  } catch (err) { next(err); }
});

router.get('/banking', async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findOne();
    if (!profile) return res.json({});
    const data = profile.toJSON();
    res.json({
      bank_name: data.bank_name || '',
      bank_account_name: data.bank_account_name || '',
      bank_account_number: data.bank_account_number || '',
      default_payment_terms: data.default_payment_terms || 30,
    });
  } catch (err) { next(err); }
});

router.put('/banking', async (req, res, next) => {
  try {
    const { bank_name, bank_account_name, bank_account_number, default_payment_terms } = req.body;
    let profile = await BusinessProfile.findOne();
    if (profile) {
      await profile.update({ bank_name, bank_account_name, bank_account_number, default_payment_terms });
    } else {
      profile = await BusinessProfile.create({ business_name: 'My Business', bank_name, bank_account_name, bank_account_number, default_payment_terms });
    }
    res.json({ message: 'Banking details updated' });
  } catch (err) { next(err); }
});

router.get('/einvoice-config', async (req, res, next) => {
  try {
    const config = await EinvoiceConfig.findOne({ order: [['id', 'DESC']] });
    if (!config) return res.json({});
    const { client_secret_enc, cached_token, ...safe } = config.toJSON();
    res.json({ ...safe, has_secret: !!client_secret_enc });
  } catch (err) { next(err); }
});

router.put('/einvoice-config', async (req, res, next) => {
  try {
    const { client_secret, ...rest } = req.body;
    const existing = await EinvoiceConfig.findOne({ order: [['id', 'DESC']] });
    const updates = { ...rest };
    if (client_secret) updates.client_secret_enc = MyInvoisService.encryptSecret(client_secret);

    let config;
    if (existing) { await existing.update(updates); config = existing; }
    else config = await EinvoiceConfig.create(updates);

    const { client_secret_enc, cached_token, ...safe } = config.toJSON();
    res.json({ ...safe, has_secret: !!client_secret_enc });
  } catch (err) { next(err); }
});

router.post('/einvoice-config/test', async (req, res, next) => {
  try {
    const token = await MyInvoisService.getAccessToken(true);
    const config = await EinvoiceConfig.findOne();
    await config?.update({ last_tested_at: new Date(), last_test_success: true });
    res.json({ success: true, message: 'Token obtained successfully' });
  } catch (err) {
    const config = await EinvoiceConfig.findOne().catch(() => null);
    await config?.update({ last_tested_at: new Date(), last_test_success: false });
    res.status(400).json({ success: false, message: err.message });
  }
});

router.get('/storage-config', async (req, res, next) => {
  try {
    const usage = await StorageService.getUsage();
    res.json(usage);
  } catch (err) { next(err); }
});

router.post('/storage-config/test', async (req, res, next) => {
  try {
    const result = await StorageService.testConnection();
    res.json({ success: true, message: 'MinIO connection successful!' });
  } catch (err) { res.status(400).json({ success: false, error: err.message }); }
});

router.get('/preferences', async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findOne();
    const { password_hash, ...prefs } = profile?.preferences || {};
    res.json(prefs);
  } catch (err) { next(err); }
});

router.put('/preferences', async (req, res, next) => {
  try {
    let profile = await BusinessProfile.findOne();
    if (!profile) profile = await BusinessProfile.create({ business_name: 'My Business' });
    const { password_hash, ...existing } = profile.preferences || {};
    await profile.update({ preferences: { ...existing, password_hash, ...req.body } });
    res.json({ message: 'Preferences updated' });
  } catch (err) { next(err); }
});

export default router;
