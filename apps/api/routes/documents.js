import { Router } from 'express';
import { verifyJwt } from '../middlewares/verifyJwt.js';
import { Document } from '../models/index.js';
import multer from 'multer';
import path from 'path';
import { UPLOAD_DIR } from '../config/storage.js';
import StorageService from '../services/StorageService.js';
import { Op } from 'sequelize';
import fs from 'fs';

const upload = multer({
  dest: path.join(UPLOAD_DIR, 'temp'),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

const router = Router();
router.use(verifyJwt);

// GET /documents?subject_type=invoice&subject_id=1&category=receipt&search=receipt
router.get('/', async (req, res, next) => {
  try {
    const { subject_type, subject_id, category, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (subject_type) where.subject_type = subject_type;
    if (category) where.subject_type = category;
    if (subject_id) where.subject_id = parseInt(subject_id);
    if (search) where.original_name = { [Op.iLike]: `%${search}%` };

    const { count, rows } = await Document.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ documents: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// GET /documents/:id/preview — serve file inline for preview
router.get('/:id/preview', async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(doc.mime_type)) {
      return res.status(415).json({ error: 'Preview not available for this file type' });
    }

    const buffer = await StorageService.download(doc.storage_path);

    res.set({
      'Content-Type': doc.mime_type,
      'Content-Disposition': `inline; filename="${doc.original_name || doc.file_name}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  } catch (err) { next(err); }
});

const ALLOWED_UPLOAD_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

// POST /documents — multipart upload; body must include subject_type + subject_id
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    if (!ALLOWED_UPLOAD_MIMES.includes(req.file.mimetype)) {
      try { fs.unlinkSync(req.file.path); } catch {}
      return res.status(400).json({ error: 'Only PDF and image files (JPG, PNG, GIF, WEBP) are allowed' });
    }

    const { subject_type, subject_id, category } = req.body;
    const docCategory = category || subject_type || 'general';

    const buffer = fs.readFileSync(req.file.path);
    try { fs.unlinkSync(req.file.path); } catch {}

    const stored = await StorageService.upload(
      buffer,
      req.file.originalname,
      req.file.mimetype,
      docCategory, // used as the storage folder name
    );

    const doc = await Document.create({
      subject_type: docCategory,
      subject_id: subject_id ? parseInt(subject_id) : 0,
      storage_type: stored.storageType,
      storage_path: stored.storagePath,
      file_name: path.basename(stored.storagePath),
      original_name: req.file.originalname,
      mime_type: req.file.mimetype,
      file_size: req.file.size,
      storage_metadata: stored.metadata || {},
    });

    res.status(201).json(doc);
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    next(err);
  }
});

// GET /documents/storage-usage
router.get('/storage-usage', async (req, res, next) => {
  try {
    const usage = await StorageService.getUsage();
    const docCount = await Document.count();
    res.json({ ...usage, documentCount: docCount });
  } catch (err) { next(err); }
});

// GET /documents/:id/download
router.get('/:id/download', async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const buffer = await StorageService.download(doc.storage_path);

    res.set({
      'Content-Type': doc.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${doc.original_name || doc.file_name}"`,
      'Content-Length': buffer.length,
    });

    res.send(buffer);
  } catch (err) { next(err); }
});

// DELETE /documents/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    try {
      await StorageService.delete(doc.storage_path, doc.storage_type);
    } catch (storageErr) {
      console.warn('Storage delete failed:', storageErr.message);
    }

    await doc.destroy();
    res.status(204).send();
  } catch (err) { next(err); }
});

export default router;
