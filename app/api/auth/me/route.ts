/*
 * Auth API - Get Current User
 * GET /api/auth/me - returns current user from JWT token
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyJWT } from '@/lib/auth/jwt';
import { dbQuerySingle } from '@/lib/db/driver';

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
        const env = (req as any).env || process.env;
        
        // ✅ الحصول على التوكن من الـ Header
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS });
        }

        const token = authHeader.split(' ')[1];
        const payload = verifyJWT(token);
        
        if (!payload) {
            return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401, headers: CORS });
        }

        // ✅ جلب بيانات المستخدم من قاعدة البيانات
        const userId = payload.userId as string;
        const user = await dbQuerySingle<{
            id: string;
            email: string;
            name: string;
            role: string;
            company_id: string;
        }>(
            'SELECT id, email, name, role, company_id FROM users WHERE id = ? AND status = "active"',
            [userId],
            env
        );

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404, headers: CORS });
        }

        // ✅ إرجاع بيانات المستخدم
        return NextResponse.json({ 
            user: user,
            success: true 
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ خطأ في /me:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS });
    }
}