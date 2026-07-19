/*
 * Independent JWT Authentication System
 */

import { dbQuerySingle } from '@/lib/db/driver';
import { createHash, randomBytes } from 'crypto';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash('sha256').update(salt + password).digest('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  const computed = createHash('sha256').update(salt + password).digest('hex');
  return hash === computed;
}

export function createJWT(payload: Record<string, unknown>): string {
  const secret = process.env.JWT_SECRET || 'fallback-secret';
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + 7 * 24 * 60 * 60 * 1000 })).toString('base64url');
  const signature = createHash('sha256').update(`${header}.${body}.${secret}`).digest('base64url');
  return `${header}.${body}.${signature}`;
}

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

export async function authenticateUser(email: string, password: string, env?: any) {
  const user = await dbQuerySingle<{ id: string; email: string; name: string; role: string; password: string; status: string }>(
    'SELECT id, email, name, role, password, status FROM users WHERE email = ? AND status = ?',
    [email, 'active'],
    env
  );

  if (!user) return null;
  if (user.password !== password) return null;

  const token = createJWT({ userId: user.id, email: user.email, role: user.role });
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
