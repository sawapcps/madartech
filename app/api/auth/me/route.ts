/*
 * Auth API — Get current user
 * GET /api/auth/me — returns the authenticated user from JWT
 */

import { NextRequest, NextResponse } from 'next/server';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    // ✅ قراءة التوكن من cookies
    const token = req.cookies.get('platform_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401, headers: CORS }
      );
    }

    // ✅ التحقق من التوكن
    if (!token.startsWith('test_token_')) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 401, headers: CORS }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: 'user_001',
          email: 'sawapcps@gmail.com',
          name: 'مدير النظام',
          role: 'admin'
        }
      }
    }, { headers: CORS });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}