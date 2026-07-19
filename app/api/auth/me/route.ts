/*
 * Auth API — Get current user
 * GET /api/auth/me — returns the authenticated user from JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get('platform_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401, headers: CORS });
  }

  const payload = verifyJWT(token);
  if (!payload) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: CORS });
  }

  return NextResponse.json({
    success: true,
    user: { id: payload.userId, email: payload.email, name: payload.name, role: payload.role },
  }, { headers: CORS });
}
