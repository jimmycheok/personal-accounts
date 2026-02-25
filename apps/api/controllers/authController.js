import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { BusinessProfile } from '../models/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';
const JWT_EXPIRES = process.env.JWT_EXPIRES_IN || '7d';

// Simple single-user auth — password stored in business_profiles.preferences.password_hash
export async function login(req, res, next) {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Password required' });

    const profile = await BusinessProfile.findOne();
    const storedHash = profile?.preferences?.password_hash;

    if (!storedHash) {
      // First login — use ADMIN_PASSWORD env var
      const defaultPass = process.env.ADMIN_PASSWORD || 'changeme123';
      if (password !== defaultPass) {
        return res.status(401).json({ error: 'Invalid password' });
      }
    } else {
      const valid = await bcrypt.compare(password, storedHash);
      if (!valid) return res.status(401).json({ error: 'Invalid password' });
    }

    const token = jwt.sign({ role: 'owner', sub: 'owner' }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
    res.json({ token, expiresIn: JWT_EXPIRES });
  } catch (err) {
    next(err);
  }
}

export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    const profile = await BusinessProfile.findOne() || await BusinessProfile.create({ business_name: 'My Business' });
    const storedHash = profile.preferences?.password_hash;
    const defaultPass = process.env.ADMIN_PASSWORD || 'changeme123';

    if (storedHash) {
      const valid = await bcrypt.compare(currentPassword, storedHash);
      if (!valid) return res.status(401).json({ error: 'Current password incorrect' });
    } else if (currentPassword !== defaultPass) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    await profile.update({
      preferences: { ...profile.preferences, password_hash: hash },
    });

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}

export async function getMe(req, res) {
  res.json({ role: 'owner', sub: req.user?.sub });
}
