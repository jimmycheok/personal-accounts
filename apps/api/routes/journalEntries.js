import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { list, getById, create, post, remove } from '../controllers/journalEntriesController.js';
import AccountingAIService from '../services/AccountingAIService.js';

const router = Router();
router.use(verifyJwt);

router.get('/', list);
router.post('/', create);

// AI-powered journal entry suggestion for transaction flows
router.post('/ai-suggest', async (req, res, next) => {
  try {
    const { type, data } = req.body;
    if (!type || !data) {
      return res.status(400).json({ error: 'type and data are required' });
    }
    const result = await AccountingAIService.suggest(type, data);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', getById);
router.post('/:id/post', post);
router.delete('/:id', remove);

export default router;
