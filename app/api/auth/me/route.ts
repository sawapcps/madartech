import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        // ✅ محاولة قراءة التوكن من Authorization header
        const authHeader = req.headers.get('authorization');
        let token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

        // ✅ إذا لم يكن في الـ Header، جرب من الكوكيز
        if (!token) {
            token = req.cookies.get('platform_token')?.value || null;
        }

        console.log('🔍 /api/auth/me - التوكن:', token ? 'موجود' : 'غير موجود');

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        if (!token.startsWith('test_token_')) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401 }
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
        });

    } catch (err) {
        console.error('❌ Me error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}