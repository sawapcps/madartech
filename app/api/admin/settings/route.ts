import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

// ✅ GET - جلب الإعدادات
export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const tenantId = url.searchParams.get('tenant_id') || '1';

        const result = await db
            .prepare('SELECT * FROM settings WHERE tenant_id = ? OR tenant_id IS NULL')
            .bind(tenantId)
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || []
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ GET Settings Error:', error);
        return NextResponse.json({ 
            error: error.message || 'فشل جلب الإعدادات' 
        }, { status: 500, headers: CORS });
    }
}

// ✅ POST - حفظ الإعدادات
export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const body = await req.json();

        const { tenant_id, key, value, category } = body;

        if (!key) {
            return NextResponse.json({ 
                error: 'key مطلوب' 
            }, { status: 400, headers: CORS });
        }

        // ✅ إذا كان المفتاح هو email أو password، قم بتحديث جدول users
        if (key === 'email' || key === 'password') {
            const userId = body.user_id || 1;
            
            if (key === 'email') {
                await db
                    .prepare('UPDATE users SET email = ? WHERE id = ?')
                    .bind(value, userId)
                    .run();
            } else if (key === 'password') {
                await db
                    .prepare('UPDATE users SET password = ? WHERE id = ?')
                    .bind(value, userId)
                    .run();
            }

            return NextResponse.json({
                success: true,
                message: `تم تحديث ${key === 'email' ? 'الإيميل' : 'كلمة المرور'} بنجاح`
            }, { headers: CORS });
        }

        // ✅ حفظ الإعدادات الأخرى في جدول settings
        await db
            .prepare(`
                INSERT INTO settings (tenant_id, key, value, category, updated_at)
                VALUES (?, ?, ?, ?, datetime('now'))
                ON CONFLICT(tenant_id, key) DO UPDATE SET
                    value = excluded.value,
                    category = excluded.category,
                    updated_at = datetime('now')
            `)
            .bind(tenant_id || null, key, value || '', category || 'general')
            .run();

        return NextResponse.json({
            success: true,
            message: 'تم حفظ الإعداد بنجاح'
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ POST Settings Error:', error);
        return NextResponse.json({ 
            error: error.message || 'فشل حفظ الإعداد' 
        }, { status: 500, headers: CORS });
    }
}