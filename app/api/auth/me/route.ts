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
        console.log('🔍 /api/auth/me - بدء الطلب');
        
        // ✅ قراءة التوكن من cookies
        const token = req.cookies.get('platform_token')?.value;
        console.log('📝 التوكن:', token ? 'موجود' : 'غير موجود');

        if (!token) {
            console.log('❌ لا يوجد توكن');
            return NextResponse.json(
                { error: 'Not authenticated' },
                { status: 401, headers: CORS }
            );
        }

        // ✅ التحقق من صحة التوكن
        console.log('🔍 التحقق من التوكن...');
        const decoded = verifyJWT(token);
        console.log('📝 التوكن المفكوك:', decoded);

        if (!decoded) {
            console.log('❌ توكن غير صالح');
            return NextResponse.json(
                { error: 'Invalid token' },
                { status: 401, headers: CORS }
            );
        }

        // ✅ جلب بيانات المستخدم
        const env = (req as any).env || process.env;
        console.log('🌍 البيئة:', env ? 'موجودة' : 'غير موجودة');

        // محاولة الحصول على قاعدة البيانات
        let db = null;
        try {
            db = (req as any).env?.DB;
            console.log('🗄️ D1:', db ? 'موجود' : 'غير موجود');
        } catch (e) {
            console.log('❌ خطأ في الوصول إلى D1:', e);
        }

        // إذا لم يكن D1 موجوداً، جرب PostgreSQL
        if (!db) {
            try {
                const { dbQuerySingle } = await import('@/lib/db/driver');
                const user = await dbQuerySingle(
                    'SELECT id, email, name, role, company_id FROM users WHERE id = $1',
                    [decoded.userId],
                    env
                );
                
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
                console.error('❌ خطأ في PostgreSQL:', err);
                return NextResponse.json(
                    { error: 'Database error: ' + (err instanceof Error ? err.message : 'Unknown') },
                    { status: 500, headers: CORS }
                );
            }
        }

        // ✅ استخدام D1
        try {
            console.log('🔍 استعلام D1 للمستخدم:', decoded.userId);
            const user = await db.prepare(
                'SELECT id, email, name, role, company_id FROM users WHERE id = ?'
            ).bind(decoded.userId).first();
            
            console.log('📝 نتيجة الاستعلام:', user ? 'موجود' : 'غير موجود');

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
            console.error('❌ خطأ في D1:', err);
            return NextResponse.json(
                { error: 'D1 error: ' + (err instanceof Error ? err.message : 'Unknown') },
                { status: 500, headers: CORS }
            );
        }

    } catch (err) {
        console.error('❌ خطأ عام في /api/auth/me:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500, headers: CORS }
        );
    }
}