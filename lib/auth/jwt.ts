/*
 * Independent JWT Authentication System
 * No Supabase Auth — uses our own platform_users table + JWT
 */

import { dbQuerySingle } from '@/lib/db/driver';
import { createHash, randomBytes } from 'crypto';

/**
 * Hash a password using SHA-256 with salt.
 * In production, use argon2 or bcrypt.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 */
export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return hash === computed;
}

/**
 * Create a JWT token (simplified — no external library).
 */
export function createJWT(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHash('sha256').update(`${header}.${body}.${secret}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

/**
 * Verify a JWT token.
 */
export function verifyJWT(token: string): Record<string, unknown> | null {
  try {
    const [header, body, signature] = token.split('.');
    const secret = process.env.JWT_SECRET || 'fallback-secret';
    const expectedSig = createHash('sha256').update(`${header}.${body}.${secret}`).digest('base64url');
    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
    if (payload.exp && Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Authenticate a user with email and password.
 */
export async function authenticateUser(email: string, password: string, env?: any) {
  // ✅ استخدام ? بدلاً من $1, $2 (مناسب لـ D1)
  const user = await dbQuerySingle<{ id: string; email: string; name: string; role: string; password_hash: string; status: string }>(
    'SELECT id, email, name, role, password_hash, status FROM users WHERE email = ? AND status = ?',
    [email, 'active'],
    env  // ← تمرير env
  );

  if (!user) return null;
  if (!verifyPassword(password, user.password_hash)) return null;

  const token = createJWT({ userId: user.id, email: user.email, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}