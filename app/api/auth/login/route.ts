/*
 * Auth API - Login
 * POST /api/auth/login - authenticate with email/password, returns JWT
 */

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth/jwt';
import { logLogin } from '@/lib/logger';

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
        const env = (req as any).env || process.env;
        
        const { email, password } = await req.json();
        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS });
        }

        const result = await authenticateUser(email, password, env);
        if (!result) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
        }

        // ✅ تسجيل حدث تسجيل الدخول في السجلات
        const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
        await logLogin(result.user.id, '1', ip);

        const response = NextResponse.json({
            success: true,
            token: result.token,
            user: result.user,
        }, { headers: CORS });

        response.cookies.set('platform_token', result.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 7 * 24 * 60 * 60,
            path: '/',
        });

        return response;
    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
    }
}