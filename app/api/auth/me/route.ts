import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        const token = req.cookies.get('platform_token')?.value;

        console.log('🔍 /api/auth/me - التوكن:', token ? 'موجود' : 'غير موجود');

        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // ✅ بيانات وهمية
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
        console.error('Me error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}