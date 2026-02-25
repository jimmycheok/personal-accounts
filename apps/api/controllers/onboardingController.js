import { BusinessProfile, EinvoiceConfig, StorageConfig } from '../models/index.js';

export async function getStatus(req, res, next) {
  try {
    const profile = await BusinessProfile.findOne();
    res.json({
      completed: profile?.setup_completed || false,
      businessProfile: !!profile,
      einvoiceConfig: !!(await EinvoiceConfig.findOne()),
      storageConfig: !!(await StorageConfig.findOne()),
    });
  } catch (err) {
    next(err);
  }
}

export async function complete(req, res, next) {
  try {
    const { businessProfile, einvoiceConfig, storageConfig } = req.body;

    // Upsert business profile
    let profile = await BusinessProfile.findOne();
    if (profile) {
      await profile.update({ ...businessProfile, setup_completed: true });
    } else {
      profile = await BusinessProfile.create({ ...businessProfile, setup_completed: true });
    }

    // Optional: save einvoice config
    if (einvoiceConfig) {
      const MyInvoisService = (await import('../services/MyInvoisService.js')).default;
      const encryptedSecret = einvoiceConfig.client_secret
        ? MyInvoisService.encryptSecret(einvoiceConfig.client_secret)
        : null;

      const existing = await EinvoiceConfig.findOne();
      if (existing) {
        await existing.update({
          tin: einvoiceConfig.tin,
          client_id: einvoiceConfig.client_id,
          client_secret_enc: encryptedSecret || existing.client_secret_enc,
          is_sandbox: einvoiceConfig.is_sandbox ?? true,
          is_enabled: true,
        });
      } else {
        await EinvoiceConfig.create({
          tin: einvoiceConfig.tin,
          client_id: einvoiceConfig.client_id,
          client_secret_enc: encryptedSecret,
          is_sandbox: einvoiceConfig.is_sandbox ?? true,
          is_enabled: true,
        });
      }
    }

    // Optional: save storage config
    if (storageConfig) {
      await StorageConfig.upsert({
        id: 1,
        storage_type: storageConfig.type || 'local',
        config_enc: storageConfig.config || {},
        is_active: true,
      });
    }

    res.json({ message: 'Onboarding completed', profile });
  } catch (err) {
    next(err);
  }
}
