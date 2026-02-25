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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
});

const router = Router();
router.use(verifyJwt);

// GET /documents
router.get('/', async (req, res, next) => {
  try {
    const { type, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (type) where.document_type = type;
    if (search) where.file_name = { [Op.iLike]: `%${search}%` };

    const { count, rows } = await Document.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.json({ documents: rows, total: count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
});

// POST /documents — upload a document
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { document_type = 'general', notes, related_id, related_type } = req.body;
    const buffer = fs.readFileSync(req.file.path);
    const folder = document_type === 'receipt' ? 'receipts' : 'documents';

    const stored = await StorageService.upload(buffer, req.file.originalname, req.file.mimetype, folder);

    // Cleanup temp file
    try { fs.unlinkSync(req.file.path); } catch {}

    const doc = await Document.create({
      file_name: req.file.originalname,
      file_size: req.file.size,
      mime_type: req.file.mimetype,
      document_type,
      storage_path: stored.storagePath,
      storage_type: stored.storageType,
      notes,
      related_id: related_id ? parseInt(related_id) : null,
      related_type,
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
    const usage = await StorageService.getStorageUsage();
    const docCount = await Document.count();
    res.json({ ...usage, documentCount: docCount });
  } catch (err) { next(err); }
});

// GET /documents/:id/download
router.get('/:id/download', async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    const { stream, contentType, fileName } = await StorageService.download(doc.storage_path, doc.storage_type);

    res.set({
      'Content-Type': contentType || doc.mime_type || 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${fileName || doc.file_name}"`,
    });

    if (stream.pipe) {
      stream.pipe(res);
    } else {
      res.send(stream);
    }
  } catch (err) { next(err); }
});

// DELETE /documents/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const doc = await Document.findByPk(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete from storage
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
