import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    try {
        // ✅ محاولة قراءة التوكن من cookies
        const token = req.cookies.get('platform_token')?.value;
        
        console.log('🔍 /api/auth/me - التوكن:', token ? 'موجود' : 'غير موجود');

        // ✅ إذا لم يكن هناك توكن، نرجع 401
        if (!token) {
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401 }
            );
        }

        // ✅ التحقق البسيط من التوكن (بدون مكتبة خارجية)
        // مجرد التحقق من أن التوكن يبدأ بـ 'test_token_'
        if (!token.startsWith('test_token_')) {
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401 }
            );
        }

        // ✅ إرجاع بيانات المستخدم
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