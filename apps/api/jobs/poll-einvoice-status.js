import { EinvoiceSubmission } from '../models/index.js';
import MyInvoisService from '../services/MyInvoisService.js';

export function definePollEinvoiceStatusJob(agenda) {
  agenda.define('poll-einvoice-status', async (job) => {
    const pendingSubmissions = await EinvoiceSubmission.findAll({
      where: { status: 'pending' },
      limit: 50,
    });

    let updated = 0;
    for (const submission of pendingSubmissions) {
      try {
        await MyInvoisService.pollStatus(submission.id);
        updated++;
      } catch (err) {
        console.error(`[poll-einvoice-status] Error polling submission ${submission.id}:`, err.message);
      }
    }

    console.log(`[poll-einvoice-status] Polled ${updated}/${pendingSubmissions.length} pending submissions`);
  });
}
