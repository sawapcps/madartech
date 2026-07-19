import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const result = await db
            .prepare('SELECT * FROM tenants ORDER BY created_at DESC')
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || [],
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ GET tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل جلب العملاء',
        }, { status: 500, headers: CORS });
    }
}

export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const body = await req.json();

        console.log('📥 POST tenants - body:', body);

        // ✅ حالة التحديث (action: 'update')
        if (body.action === 'update' && body.id) {
            const { id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes } = body;

            await db
                .prepare(`
                    UPDATE tenants SET
                        name = ?,
                        email = ?,
                        phone = ?,
                        company = ?,
                        status = ?,
                        storage_limit_mb = ?,
                        db_limit_mb = ?,
                        notes = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `)
                .bind(
                    name,
                    email,
                    phone || null,
                    company || null,
                    status || 'active',
                    storage_limit_mb || 5120,
                    db_limit_mb || 1024,
                    notes || null,
                    id
                )
                .run();

            const updated = await db
                .prepare('SELECT * FROM tenants WHERE id = ?')
                .bind(id)
                .all();

            return NextResponse.json({
                success: true,
                data: updated.results?.[0] || null,
                message: 'تم تحديث العميل بنجاح',
            }, { headers: CORS });
        }

        // ✅ إضافة عميل جديد
        const { name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes } = body;

        if (!name || !email) {
            return NextResponse.json({
                success: false,
                error: 'الاسم والبريد الإلكتروني مطلوبان',
            }, { status: 400, headers: CORS });
        }

        // التحقق من عدم تكرار البريد
        const existing = await db
            .prepare('SELECT id FROM tenants WHERE email = ?')
            .bind(email)
            .all();

        if (existing.results && existing.results.length > 0) {
            return NextResponse.json({
                success: false,
                error: 'البريد الإلكتروني مستخدم بالفعل',
            }, { status: 409, headers: CORS });
        }

        // ✅ إنشاء subdomain فريد من الاسم + رقم عشوائي
        const baseSubdomain = name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')
            .substring(0, 20);

        // ✅ إضافة رقم عشوائي لضمان uniqueness
        const randomSuffix = Math.random().toString(36).substring(2, 6);
        const subdomain = `${baseSubdomain}-${randomSuffix}`;

        // ✅ إنشاء api_key
        const apiKey = `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        const result = await db
            .prepare(`
                INSERT INTO tenants (
                    name, email, phone, company, status,
                    storage_limit_mb, db_limit_mb, api_key, notes,
                    subdomain, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                name,
                email,
                phone || null,
                company || null,
                status || 'active',
                storage_limit_mb || 5120,
                db_limit_mb || 1024,
                apiKey,
                notes || null,
                subdomain
            )
            .run();

        const newClient = await db
            .prepare('SELECT * FROM tenants WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        return NextResponse.json({
            success: true,
            data: newClient.results?.[0] || null,
            message: 'تم إضافة العميل بنجاح',
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ POST tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل حفظ العميل',
        }, { status: 500, headers: CORS });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'معرف العميل مطلوب',
            }, { status: 400, headers: CORS });
        }

        await db
            .prepare('DELETE FROM tenants WHERE id = ?')
            .bind(id)
            .run();

        return NextResponse.json({
            success: true,
            message: 'تم حذف العميل بنجاح',
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ DELETE tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل حذف العميل',
        }, { status: 500, headers: CORS });
    }
}