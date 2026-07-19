/*
 * Auth API — Login
 * POST /api/auth/login — authenticate with email/password, returns JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/jwt';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS });
    }

    const result = await authenticateUser(email, password);
    if (!result) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
    }

    const response = NextResponse.json({
      success: true,
      token: result.token,
      user: result.user,
    }, { headers: CORS });

    // Set HTTP-only cookie
    response.cookies.set('platform_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}
