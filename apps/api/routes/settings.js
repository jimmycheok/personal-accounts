import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { BusinessProfile, EinvoiceConfig, StorageConfig } from '../models/index.js';
import MyInvoisService from '../services/MyInvoisService.js';
import StorageService from '../services/StorageService.js';

const router = Router();
router.use(verifyJwt);

router.get('/business-profile', async (req, res, next) => {
  try {
    const profile = await BusinessProfile.findOne();
    res.json(profile || {});
  } catch (err) { next(err); }
});

router.put('/business-profile', async (req, res, next) => {
  try {
    let profile = await BusinessProfile.findOne();
    if (profile) await profile.update(req.body);
    else profile = await BusinessProfile.create(req.body);
    res.json(profile);
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
    const config = await StorageConfig.findOne({ where: { is_active: true } });
    if (!config) return res.json({ storage_type: 'local' });
    const { config_enc, ...safe } = config.toJSON();
    res.json({ ...safe, config: { type: config.storage_type } });
  } catch (err) { next(err); }
});

router.put('/storage-config', async (req, res, next) => {
  try {
    const { type, config = {} } = req.body;
    await StorageConfig.upsert({ id: 1, storage_type: type, config_enc: config, is_active: true });
    res.json({ message: 'Storage config updated' });
  } catch (err) { next(err); }
});

router.post('/storage-config/test', async (req, res, next) => {
  try {
    const result = await StorageService.testConnection(req.body.type, req.body.config || {});
    res.json(result);
  } catch (err) { res.status(400).json({ success: false, message: err.message }); }
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
