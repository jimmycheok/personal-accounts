import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

function getS3Client() {
  const endpoint = process.env.MINIO_ENDPOINT || 'http://localhost:9000';
  return new S3Client({
    endpoint,
    region: 'us-east-1', // MinIO ignores region but S3Client requires it
    credentials: {
      accessKeyId: process.env.MINIO_ACCESS_KEY || 'pa_minio',
      secretAccessKey: process.env.MINIO_SECRET_KEY || 'pa_minio_secret',
    },
    forcePathStyle: true, // Required for MinIO
  });
}

function getBucket() {
  return process.env.MINIO_BUCKET || 'pa-documents';
}

function getStoragePath(type, year, month, filename) {
  return `${type}/${year}/${String(month).padStart(2, '0')}/${filename}`;
}

class StorageService {
  async upload(fileBuffer, originalName, mimeType, subjectType) {
    const ext = path.extname(originalName);
    const uuid = uuidv4();
    const fileName = `${uuid}${ext}`;
    const now = new Date();
    const storagePath = getStoragePath(subjectType, now.getFullYear(), now.getMonth() + 1, fileName);

    const s3 = getS3Client();
    await s3.send(new PutObjectCommand({
      Bucket: getBucket(),
      Key: storagePath,
      Body: fileBuffer,
      ContentType: mimeType,
    }));

    return { storageType: 'minio', storagePath, fileName, originalName, mimeType, fileSize: fileBuffer.length };
  }

  async download(storagePath) {
    const s3 = getS3Client();
    const { Body } = await s3.send(new GetObjectCommand({
      Bucket: getBucket(),
      Key: storagePath,
    }));
    const chunks = [];
    for await (const chunk of Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }

  async getSignedUrl(storagePath, _storageType, expiresIn = 3600) {
    const s3 = getS3Client();
    return getSignedUrl(s3, new GetObjectCommand({
      Bucket: getBucket(),
      Key: storagePath,
    }), { expiresIn });
  }

  async delete(storagePath) {
    const s3 = getS3Client();
    await s3.send(new DeleteObjectCommand({
      Bucket: getBucket(),
      Key: storagePath,
    }));
  }

  async getUsage() {
    const s3 = getS3Client();
    let totalSize = 0;
    let continuationToken;

    do {
      const res = await s3.send(new ListObjectsV2Command({
        Bucket: getBucket(),
        ContinuationToken: continuationToken,
      }));
      if (res.Contents) {
        for (const obj of res.Contents) {
          totalSize += obj.Size || 0;
        }
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);

    return { type: 'minio', usedBytes: totalSize };
  }

  async testConnection() {
    const s3 = getS3Client();
    await s3.send(new ListObjectsV2Command({ Bucket: getBucket(), MaxKeys: 1 }));
    return { success: true };
  }
}

export default new StorageService();
