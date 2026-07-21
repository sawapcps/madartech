/*
 * Auth API — Login
 * POST /api/auth/login — authenticate with email/password, returns JWT
 */

import { NextRequest, NextResponse } from 'next/server';

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
    
    // ✅ بيانات ثابتة للتجربة
    if (email === 'sawapcps@gmail.com' && password === '123456') {
      // ✅ إنشاء توكن بسيط
      const token = 'test_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

      const response = NextResponse.json({
        success: true,
        data: {
          user: {
            id: 'user_001',
            email: 'sawapcps@gmail.com',
            name: 'مدير النظام',
            role: 'admin'
          },
          token: token
        }
      });

      // ✅ تعيين الكوكي
      response.cookies.set('platform_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60, // 7 أيام
        path: '/',
      });

      return response;
    }

    return NextResponse.json(
      { error: 'بيانات الدخول غير صحيحة' },
      { status: 401, headers: CORS }
    );

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}