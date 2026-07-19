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
        // ✅ استخدام console.error للتأكد من ظهورها
        console.error('🔍 Login attempt started');

        const { email, password } = await req.json();
        console.error('📧 Email:', email);
        console.error('🔑 Password received:', password ? 'Yes' : 'No');

        if (!email || !password) {
            console.error('❌ Missing email or password');
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS });
        }

        console.error('🔍 Calling authenticateUser...');
        const result = await authenticateUser(email, password);
        console.error('🔍 Result:', result ? 'User found' : 'No user found');

        if (!result) {
            console.error('❌ Invalid credentials');
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
        }

        console.error('✅ Login successful for:', email);

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
        console.error('🔥 Login error:', err);
        console.error('🔥 Error stack:', err instanceof Error ? err.stack : 'No stack');
        return NextResponse.json({
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500, headers: CORS });
    }
}