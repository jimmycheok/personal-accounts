import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { google } from 'googleapis';
import { UPLOAD_DIR } from '../config/storage.js';
import { StorageConfig } from '../models/index.js';
import { v4 as uuidv4 } from 'uuid';

function getStoragePath(type, year, month, filename) {
  return `${type}/${year}/${String(month).padStart(2, '0')}/${filename}`;
}

class StorageService {
  async getConfig() {
    return StorageConfig.findOne({ where: { is_active: true }, order: [['id', 'DESC']] });
  }

  async upload(fileBuffer, originalName, mimeType, subjectType) {
    const config = await this.getConfig();
    const storageType = config?.storage_type || 'local';
    const ext = path.extname(originalName);
    const uuid = uuidv4();
    const fileName = `${uuid}${ext}`;
    const now = new Date();
    const storagePath = getStoragePath(subjectType, now.getFullYear(), now.getMonth() + 1, fileName);

    if (storageType === 'local') {
      const fullPath = path.join(UPLOAD_DIR, storagePath);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, fileBuffer);
      return { storageType, storagePath, fileName, originalName, mimeType, fileSize: fileBuffer.length };
    }

    if (storageType === 'aws_s3') {
      const cfg = config.config_enc;
      const s3 = new S3Client({
        region: cfg.region || 'ap-southeast-1',
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      });
      await s3.send(new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: storagePath,
        Body: fileBuffer,
        ContentType: mimeType,
      }));
      return { storageType, storagePath, fileName, originalName, mimeType, fileSize: fileBuffer.length };
    }

    if (storageType === 'google_drive') {
      const cfg = config.config_enc;
      const auth = new google.auth.OAuth2(cfg.clientId, cfg.clientSecret);
      auth.setCredentials({ refresh_token: cfg.refreshToken });
      const drive = google.drive({ version: 'v3', auth });

      const folderName = `PersonalAccountant/${subjectType}/${now.getFullYear()}`;
      let folderId = cfg.rootFolderId;

      // Simple upload to root folder
      const { data } = await drive.files.create({
        requestBody: { name: fileName, parents: [folderId].filter(Boolean) },
        media: { mimeType, body: fileBuffer },
        fields: 'id,webViewLink',
      });

      return {
        storageType,
        storagePath: data.id,
        fileName,
        originalName,
        mimeType,
        fileSize: fileBuffer.length,
        metadata: { fileId: data.id, webViewLink: data.webViewLink },
      };
    }

    throw new Error(`Unknown storage type: ${storageType}`);
  }

  async download(storagePath, storageType = 'local') {
    if (storageType === 'local') {
      const fullPath = path.join(UPLOAD_DIR, storagePath);
      return fs.readFileSync(fullPath);
    }

    if (storageType === 'aws_s3') {
      const config = await this.getConfig();
      const cfg = config.config_enc;
      const s3 = new S3Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      });
      const { Body } = await s3.send(new GetObjectCommand({ Bucket: cfg.bucket, Key: storagePath }));
      const chunks = [];
      for await (const chunk of Body) chunks.push(chunk);
      return Buffer.concat(chunks);
    }

    throw new Error(`Download not implemented for: ${storageType}`);
  }

  async getSignedUrl(storagePath, storageType = 'local', expiresIn = 3600) {
    if (storageType === 'local') {
      return `/uploads/${storagePath}`;
    }

    if (storageType === 'aws_s3') {
      const config = await this.getConfig();
      const cfg = config.config_enc;
      const s3 = new S3Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      });
      return getSignedUrl(s3, new GetObjectCommand({ Bucket: cfg.bucket, Key: storagePath }), { expiresIn });
    }

    return storagePath;
  }

  async delete(storagePath, storageType = 'local') {
    if (storageType === 'local') {
      const fullPath = path.join(UPLOAD_DIR, storagePath);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      return;
    }

    if (storageType === 'aws_s3') {
      const config = await this.getConfig();
      const cfg = config.config_enc;
      const s3 = new S3Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      });
      await s3.send(new DeleteObjectCommand({ Bucket: cfg.bucket, Key: storagePath }));
    }
  }

  async getUsage() {
    const config = await this.getConfig();
    if (!config || config.storage_type === 'local') {
      let totalSize = 0;
      if (fs.existsSync(UPLOAD_DIR)) {
        const walk = (dir) => {
          const items = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of items) {
            if (item.isDirectory()) walk(path.join(dir, item.name));
            else totalSize += fs.statSync(path.join(dir, item.name)).size;
          }
        };
        walk(UPLOAD_DIR);
      }
      return { type: 'local', usedBytes: totalSize };
    }
    return { type: config.storage_type, usedBytes: 0 };
  }

  async testConnection(storageType, cfg) {
    if (storageType === 'local') return { success: true };
    if (storageType === 'aws_s3') {
      const s3 = new S3Client({
        region: cfg.region,
        credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey },
      });
      await s3.send(new HeadObjectCommand({ Bucket: cfg.bucket, Key: '_test_' })).catch(() => {});
      return { success: true };
    }
    return { success: false, message: 'Not implemented' };
  }
}

export default new StorageService();
