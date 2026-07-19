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
        console.log('🔍 Login attempt started');

        const { email, password } = await req.json();
        console.log('📧 Email:', email);
        console.log('🔑 Password length:', password?.length || 0);

        if (!email || !password) {
            console.log('❌ Missing email or password');
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS });
        }

        console.log('🔍 Calling authenticateUser...');
        const result = await authenticateUser(email, password);
        console.log('🔍 Result:', result ? 'User found' : 'No user found');

        if (!result) {
            console.log('❌ Invalid credentials');
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
        }

        console.log('✅ Login successful for:', email);

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
            error: err instanceof Error ? err.message : 'Unknown error',
            details: err instanceof Error ? err.stack : 'No details'
        }, { status: 500, headers: CORS });
    }
}