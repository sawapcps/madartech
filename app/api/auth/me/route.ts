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
    try {
        const env = (req as any).env || process.env;
        
        // ✅ قراءة التوكن من cookies
        const token = req.cookies.get('platform_token')?.value;

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401, headers: CORS }
            );
        }

        // ✅ التحقق من صحة التوكن
const decoded = verifyJWT(token);
        if (!decoded) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401, headers: CORS }
            );
        }

        // ✅ جلب بيانات المستخدم من قاعدة البيانات
        const db = (req as any).env?.DB || (req as any).env?.DATABASE;
        if (!db) {
            return NextResponse.json(
                { error: 'Database not available' },
                { status: 500, headers: CORS }
            );
        }

        const user = await db.prepare(
            'SELECT id, email, name, role, company_id FROM users WHERE id = ?'
        ).bind(decoded.userId).first();

        if (!user) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 401, headers: CORS }
            );
        }

        return NextResponse.json({
            success: true,
            data: { user }
        }, { headers: CORS });

    } catch (err) {
        console.error('Me error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500, headers: CORS }
        );
    }
}