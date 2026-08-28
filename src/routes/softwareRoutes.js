/**
 * softwareRoutes.js — Software Upload & Download via Cloudflare R2
 *
 * Uses the S3-compatible API to store installer files on Cloudflare R2.
 *
 * Guardrails (stay within R2 free tier):
 *   - Max 3 files stored at any time (oldest auto-deleted on upload)
 *   - Max 500 MB per file upload
 *   - Total bucket cap checked before upload (1.5 GB)
 *   - Public download endpoint rate-limited to 30 req/hr per IP
 *
 * Routes:
 *   GET  /api/software/download         — Download the latest version (public)
 *   GET  /api/software/info             — Check if software is available (public)
 *   POST /api/admin/software/upload     — Upload a new version (admin only)
 *   GET  /api/admin/software/versions   — List stored versions (admin only)
 */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const rateLimit = require('express-rate-limit');

const {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  DeleteObjectCommand,
  HeadObjectCommand,
} = require('@aws-sdk/client-s3');

const adminAuth = require('../middleware/adminAuth');
const { adminLimiter } = require('../middleware/rateLimiter');

// ─── Guardrail Constants ────────────────────────────────────────────
const MAX_FILE_SIZE = 500 * 1024 * 1024;     // 500 MB per upload
const MAX_TOTAL_STORAGE = 1.5 * 1024 * 1024 * 1024; // 1.5 GB total bucket cap
const MAX_VERSIONS = 3;                       // Keep at most 3 versions

// ─── R2 Client ──────────────────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'microlab-software';

let s3Client = null;

if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
  console.log('✅ Cloudflare R2 client initialized');
} else {
  console.warn('⚠️  R2 credentials not set — software upload/download will be disabled.');
}

// ─── Multer (in-memory buffer, no local disk needed) ────────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
});

// ─── Download Rate Limiter (30 req/hr per IP) ───────────────────────
const downloadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many download requests. Please try again later.' },
});

// ─── Helper: List all objects sorted newest-first ───────────────────
async function listVersions() {
  const command = new ListObjectsV2Command({
    Bucket: R2_BUCKET_NAME,
    Prefix: 'releases/',
  });
  const response = await s3Client.send(command);
  const objects = response.Contents || [];

  // Sort by LastModified descending (newest first)
  return objects.sort((a, b) => b.LastModified - a.LastModified);
}

// ─── Helper: Compute total storage used ─────────────────────────────
function totalSize(objects) {
  return objects.reduce((sum, obj) => sum + (obj.Size || 0), 0);
}

// ═══════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/software/info
 * Returns whether software is available for download (no R2 operation cost if empty).
 */
router.get('/software/info', async (req, res) => {
  if (!s3Client) {
    return res.json({ available: false, message: 'Downloads not configured.' });
  }
  try {
    const versions = await listVersions();
    if (versions.length === 0) {
      return res.json({ available: false, message: 'No software uploaded yet.' });
    }
    const latest = versions[0];
    return res.json({
      available: true,
      fileName: path.basename(latest.Key),
      uploadedAt: latest.LastModified,
      sizeBytes: latest.Size,
    });
  } catch (err) {
    console.error('Software info error:', err);
    return res.status(500).json({ available: false, message: 'Failed to check software.' });
  }
});

/**
 * GET /api/software/download
 * Stream the latest version directly from R2 to the user.
 * Rate-limited to 30 req/hr per IP to stay within Class B ops free tier.
 */
router.get('/software/download', downloadLimiter, async (req, res) => {
  if (!s3Client) {
    return res.status(503).json({ error: 'Downloads not configured.' });
  }
  try {
    const versions = await listVersions();
    if (versions.length === 0) {
      return res.status(404).json({ error: 'No software available for download.' });
    }

    const latest = versions[0];
    const ext = path.extname(latest.Key) || '.exe';
    const downloadName = `MicroLab_Pro_Setup${ext}`;

    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: latest.Key,
    });
    const response = await s3Client.send(command);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);
    if (response.ContentLength) {
      res.setHeader('Content-Length', response.ContentLength);
    }

    // Stream from R2 → response
    response.Body.pipe(res);
  } catch (err) {
    console.error('Download error:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to download file.' });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════

/**
 * GET /api/admin/software/versions
 * List all stored versions with metadata.
 */
router.get('/versions', adminAuth, adminLimiter, async (req, res) => {
  if (!s3Client) {
    return res.status(503).json({ error: 'R2 not configured.' });
  }
  try {
    const versions = await listVersions();
    return res.json({
      versions: versions.map((v, i) => ({
        key: v.Key,
        fileName: path.basename(v.Key),
        sizeBytes: v.Size,
        sizeMB: (v.Size / (1024 * 1024)).toFixed(2),
        uploadedAt: v.LastModified,
        isLatest: i === 0,
      })),
      totalStorageMB: (totalSize(versions) / (1024 * 1024)).toFixed(2),
      maxVersions: MAX_VERSIONS,
    });
  } catch (err) {
    console.error('List versions error:', err);
    return res.status(500).json({ error: 'Failed to list versions.' });
  }
});

/**
 * POST /api/admin/software/upload
 * Upload a new version to R2.
 * Guardrails: max file size, total storage cap, auto-cleanup of old versions.
 */
router.post('/upload', adminAuth, adminLimiter, upload.single('softwareFile'), async (req, res) => {
  if (!s3Client) {
    return res.status(503).json({ error: 'R2 not configured. Set R2 env vars.' });
  }
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    const fileBuffer = req.file.buffer;
    const fileSize = fileBuffer.length;
    const ext = path.extname(req.file.originalname) || '.exe';

    // Guardrail: check file size (multer should catch this, but double-check)
    if (fileSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: `File too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
      });
    }

    // Guardrail: check total storage before uploading
    const existingVersions = await listVersions();
    const currentStorage = totalSize(existingVersions);

    if (currentStorage + fileSize > MAX_TOTAL_STORAGE) {
      return res.status(400).json({
        error: `Upload would exceed storage cap (${(MAX_TOTAL_STORAGE / (1024 * 1024 * 1024)).toFixed(1)} GB). ` +
          `Current usage: ${(currentStorage / (1024 * 1024)).toFixed(0)} MB. ` +
          `Delete older versions first.`,
      });
    }

    // Upload to R2
    const timestamp = Date.now();
    const key = `releases/microlab-pro-${timestamp}${ext}`;

    await s3Client.send(new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }));

    console.log(`Uploaded software: ${key} (${(fileSize / (1024 * 1024)).toFixed(1)} MB)`);

    // Guardrail: auto-delete oldest versions beyond MAX_VERSIONS
    const updatedVersions = await listVersions();
    if (updatedVersions.length > MAX_VERSIONS) {
      const toDelete = updatedVersions.slice(MAX_VERSIONS);
      for (const old of toDelete) {
        try {
          await s3Client.send(new DeleteObjectCommand({
            Bucket: R2_BUCKET_NAME,
            Key: old.Key,
          }));
          console.log(`Deleted old version: ${old.Key}`);
        } catch (delErr) {
          console.error(`Failed to delete ${old.Key}:`, delErr.message);
        }
      }
    }

    return res.json({
      success: true,
      message: 'Software uploaded successfully.',
      file: path.basename(key),
      sizeMB: (fileSize / (1024 * 1024)).toFixed(2),
    });
  } catch (err) {
    console.error('Upload error:', err);
    // Handle multer file-size error
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: `File too large. Maximum allowed: ${MAX_FILE_SIZE / (1024 * 1024)} MB.`,
      });
    }
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

module.exports = router;
