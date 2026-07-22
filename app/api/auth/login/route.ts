/*
 * Auth API — Login
 * POST /api/auth/login — authenticate with email/password, returns JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbQuerySingle } from '@/lib/db/driver';

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

    // ✅ البحث عن المستخدم في قاعدة البيانات
    const user = await dbQuerySingle<{
      id: string;
      email: string;
      password: string;
      name: string;
      role: string;
    }>(
      'SELECT id, email, password, name, role FROM users WHERE email = $1',
      [email]
    );

    // ✅ التحقق من وجود المستخدم
    if (!user) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني غير موجود' },
        { status: 401, headers: CORS }
      );
    }

    // ✅ التحقق من كلمة المرور (مقارنة نصية)
    if (user.password !== password) {
      return NextResponse.json(
        { error: 'كلمة المرور غير صحيحة' },
        { status: 401, headers: CORS }
      );
    }

    // ✅ إنشاء توكن بسيط
    const token = 'test_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

    const response = NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
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

  } catch (err) {
    console.error('❌ Login error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}