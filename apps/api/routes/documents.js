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

// GET /documents?subject_type=invoice&subject_id=1&search=receipt
router.get('/', async (req, res, next) => {
  try {
    const { subject_type, subject_id, search, page = 1, limit = 50 } = req.query;
    const where = {};
    if (subject_type) where.subject_type = subject_type;
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

// POST /documents — multipart upload; body must include subject_type + subject_id
router.post('/', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const { subject_type = 'general', subject_id } = req.body;

    const buffer = fs.readFileSync(req.file.path);
    try { fs.unlinkSync(req.file.path); } catch {}

    const stored = await StorageService.upload(
      buffer,
      req.file.originalname,
      req.file.mimetype,
      subject_type, // used as the storage folder name
    );

    const doc = await Document.create({
      subject_type,
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
      'Content-Disposition': `attachment; filename="${fileName || doc.original_name || doc.file_name}"`,
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
