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
        console.error('🔍 Login attempt started');

        // 🔑 الحصول على env من الطلب
        const env = (req as any).env || process.env;
        console.error('🔍 Env available:', env ? 'Yes' : 'No');
        console.error('🔍 env.DB available:', env?.DB ? 'Yes' : 'No');

        const { email, password } = await req.json();
        console.error('📧 Email:', email);

        if (!email || !password) {
            return NextResponse.json({ error: 'Email and password are required' }, { status: 400, headers: CORS });
        }

        console.error('🔍 Calling authenticateUser with env...');
        const result = await authenticateUser(email, password, env);

        if (!result) {
            return NextResponse.json({ error: 'Invalid credentials' }, { status: 401, headers: CORS });
        }

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
        return NextResponse.json({
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500, headers: CORS });
    }
}