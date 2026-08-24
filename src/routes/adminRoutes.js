/**
 * adminRoutes.js — Admin Portal API Routes
 *
 * All routes require Authorization: Bearer <admin_token> header.
 * The admin token is obtained by calling POST /admin/login.
 *
 * Routes:
 *   POST   /admin/login            — Authenticate admin
 *   GET    /admin/dashboard-stats   — KPI summary
 *   GET    /admin/licenses          — Paginated license list
 *   POST   /admin/licenses          — Generate new license
 *   GET    /admin/licenses/:id      — License detail with activations
 *   PATCH  /admin/licenses/:id      — Update status/expiry/maxActivations
 *   DELETE /admin/licenses/:id      — Hard delete (0 activations only)
 *   PATCH  /admin/activations/:id/revoke — Revoke a single activation
 *   POST   /admin/change-password   — Change admin password
 *   GET    /admin/health            — Server health check
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const adminAuth = require('../middleware/adminAuth');
const { adminLimiter } = require('../middleware/rateLimiter');
const { signAdminToken } = require('../utils/jwt');
const { generateNewLicense } = require('../services/licenseService');

const prisma = new PrismaClient();

// ─── Admin Login (no auth required) ─────────────────────────────────

/**
 * POST /admin/login
 * Authenticates the admin using env-var credentials.
 * Returns an 8-hour JWT.
 */
router.post('/login', adminLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME;
    const adminPass = process.env.ADMIN_PASSWORD;

    if (!adminUser || !adminPass) {
      return res.status(500).json({ error: 'Admin credentials not configured on server.' });
    }

    if (username !== adminUser || password !== adminPass) {
      return res.status(401).json({ error: 'Invalid admin credentials.' });
    }

    const token = signAdminToken({ username: adminUser, role: 'admin' });
    return res.json({ success: true, token });
  } catch (err) {
    console.error('Admin login error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
});

// ─── All routes below require admin auth ────────────────────────────
router.use(adminAuth);
router.use(adminLimiter);

// ─── Dashboard Stats ────────────────────────────────────────────────

/**
 * GET /admin/dashboard-stats
 * Returns KPI summary for the admin dashboard.
 */
router.get('/dashboard-stats', async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLicenses, activeLicenses, suspendedLicenses, totalCustomers] = await Promise.all([
      prisma.license.count(),
      prisma.license.count({ where: { status: 'active' } }),
      prisma.license.count({ where: { status: 'suspended' } }),
      prisma.customer.count(),
    ]);

    const todayActivations = await prisma.activation.count({
      where: { activatedAt: { gte: today } },
    });

    // Licenses issued per month (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const monthlyLicenses = await prisma.license.groupBy({
      by: ['createdAt'],
      where: { createdAt: { gte: sixMonthsAgo } },
      _count: true,
    });

    // Aggregate by month
    const monthlyData = {};
    monthlyLicenses.forEach((entry) => {
      const key = entry.createdAt.toISOString().substring(0, 7); // YYYY-MM
      monthlyData[key] = (monthlyData[key] || 0) + entry._count;
    });

    // Plan distribution
    const planDistribution = await prisma.license.groupBy({
      by: ['plan'],
      _count: true,
    });

    // Recent activations
    const recentActivations = await prisma.activation.findMany({
      take: 10,
      orderBy: { activatedAt: 'desc' },
      include: {
        license: {
          select: { key: true, plan: true },
        },
      },
    });

    return res.json({
      totalLicenses,
      activeLicenses,
      suspendedLicenses,
      totalCustomers,
      todayActivations,
      monthlyData,
      planDistribution: planDistribution.map((p) => ({
        plan: p.plan,
        count: p._count,
      })),
      recentActivations: recentActivations.map((a) => ({
        id: a.id,
        licenseKey: a.license.key.substring(0, 9) + '****-****', // Masked
        plan: a.license.plan,
        machineLabel: a.machineLabel || a.machineId.substring(0, 12) + '...',
        activatedAt: a.activatedAt,
      })),
    });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: 'Failed to load dashboard stats.' });
  }
});

// ─── License CRUD ───────────────────────────────────────────────────

/**
 * GET /admin/licenses
 * Paginated, searchable, filterable license list.
 */
router.get('/licenses', async (req, res) => {
  try {
    const { search, plan, status, page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const take = parseInt(limit, 10);

    const where = {};
    if (plan && plan !== 'all') where.plan = plan;
    if (status && status !== 'all') where.status = status;
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { customerName: { contains: search, mode: 'insensitive' } },
        { customerEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [licenses, total] = await Promise.all([
      prisma.license.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: { select: { activations: true } },
          customer: { select: { labName: true, ownerName: true, email: true } },
        },
      }),
      prisma.license.count({ where }),
    ]);

    return res.json({
      licenses,
      total,
      page: parseInt(page, 10),
      totalPages: Math.ceil(total / take),
    });
  } catch (err) {
    console.error('Get licenses error:', err);
    return res.status(500).json({ error: 'Failed to load licenses.' });
  }
});

/**
 * POST /admin/licenses
 * Generate a new license key (vendor-created).
 */
router.post('/licenses', async (req, res) => {
  try {
    const result = await generateNewLicense(req.body);
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(201).json(result);
  } catch (err) {
    console.error('Generate license error:', err);
    return res.status(500).json({ error: 'Failed to generate license.' });
  }
});

/**
 * GET /admin/licenses/:id
 * Full license detail with all activations.
 */
router.get('/licenses/:id', async (req, res) => {
  try {
    const license = await prisma.license.findUnique({
      where: { id: req.params.id },
      include: {
        customer: true,
        activations: {
          orderBy: { activatedAt: 'desc' },
        },
      },
    });

    if (!license) {
      return res.status(404).json({ error: 'License not found.' });
    }

    return res.json(license);
  } catch (err) {
    console.error('Get license detail error:', err);
    return res.status(500).json({ error: 'Failed to load license details.' });
  }
});

/**
 * PATCH /admin/licenses/:id
 * Update license properties: status, maxActivations, expiresAt, isTrial, notes.
 */
router.patch('/licenses/:id', async (req, res) => {
  try {
    const { status, maxActivations, expiresAt, isTrial, notes, numRoles } = req.body;
    const updateData = {};

    if (status !== undefined) updateData.status = status;
    if (maxActivations !== undefined) updateData.maxActivations = parseInt(maxActivations, 10);
    if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isTrial !== undefined) updateData.isTrial = isTrial;
    if (notes !== undefined) updateData.notes = notes;
    if (numRoles !== undefined) updateData.numRoles = parseInt(numRoles, 10);

    const license = await prisma.license.update({
      where: { id: req.params.id },
      data: updateData,
    });

    return res.json({ success: true, license });
  } catch (err) {
    console.error('Update license error:', err);
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'License not found.' });
    }
    return res.status(500).json({ error: 'Failed to update license.' });
  }
});

/**
 * DELETE /admin/licenses/:id
 * Hard delete — only allowed if there are 0 activations.
 */
router.delete('/licenses/:id', async (req, res) => {
  try {
    const license = await prisma.license.findUnique({
      where: { id: req.params.id },
      include: {
        activations: {
          where: { isRevoked: false },
          select: { id: true },
        },
      },
    });

    if (!license) {
      return res.status(404).json({ error: 'License not found.' });
    }

    const activeCount = license.activations.length;
    if (activeCount > 0) {
      return res.status(400).json({
        error: `Cannot delete — this license has ${activeCount} active activation(s). Revoke them first.`,
      });
    }

    await prisma.license.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch (err) {
    console.error('Delete license error:', err);
    return res.status(500).json({ error: 'Failed to delete license.' });
  }
});

// ─── Activation Management ──────────────────────────────────────────

/**
 * PATCH /admin/activations/:id/revoke
 * Revoke a single activation (frees up a license slot).
 */
router.patch('/activations/:id/revoke', async (req, res) => {
  try {
    const activation = await prisma.activation.findUnique({
      where: { id: req.params.id },
      include: { license: true },
    });

    if (!activation) {
      return res.status(404).json({ error: 'Activation not found.' });
    }

    if (activation.isRevoked) {
      return res.status(400).json({ error: 'Activation is already revoked.' });
    }

    await prisma.$transaction([
      prisma.activation.update({
        where: { id: activation.id },
        data: { isRevoked: true },
      }),
      prisma.license.update({
        where: { id: activation.licenseId },
        data: { activationCount: { decrement: 1 } },
      }),
    ]);

    return res.json({ success: true });
  } catch (err) {
    console.error('Revoke activation error:', err);
    return res.status(500).json({ error: 'Failed to revoke activation.' });
  }
});

// ─── Admin Settings ─────────────────────────────────────────────────

/**
 * POST /admin/change-password
 * Change the admin password (updates ADMIN_PASSWORD env var at runtime).
 * Note: This only persists until server restart. For persistence, update the env var on Railway.
 */
router.post('/change-password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required.' });
    }

    if (currentPassword !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    }

    // Update in-memory (persists until restart)
    process.env.ADMIN_PASSWORD = newPassword;

    return res.json({
      success: true,
      message: 'Password updated for this session. Update the ADMIN_PASSWORD env var on Railway for persistence.',
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to change password.' });
  }
});

/**
 * GET /admin/health
 * Simple health check — verifies server and DB connectivity.
 */
router.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ status: 'unhealthy', error: err.message });
  }
});

module.exports = router;
