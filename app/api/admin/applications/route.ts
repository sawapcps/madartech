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
            .prepare('SELECT * FROM applications ORDER BY created_at DESC')
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || [],
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ GET applications error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل جلب التطبيقات',
        }, { status: 500, headers: CORS });
    }
}

export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const body = await req.json();

        console.log('📥 POST applications - body:', body);

        // ✅ حالة التحديث (action: 'update')
        if (body.action === 'update' && body.id) {
            const { id, name, slug, description, version, status } = body;

            await db
                .prepare(`
                    UPDATE applications SET
                        name = ?,
                        slug = ?,
                        description = ?,
                        version = ?,
                        status = ?,
                        updated_at = datetime('now')
                    WHERE id = ?
                `)
                .bind(
                    name,
                    slug || name.toLowerCase().replace(/\s+/g, '-'),
                    description || null,
                    version || '1.0.0',
                    status || 'active',
                    id
                )
                .run();

            const updated = await db
                .prepare('SELECT * FROM applications WHERE id = ?')
                .bind(id)
                .all();

            return NextResponse.json({
                success: true,
                data: updated.results?.[0] || null,
                message: 'تم تحديث التطبيق بنجاح',
            }, { headers: CORS });
        }

        // ✅ إضافة تطبيق جديد
        const { name, slug, description, version, status, tenant_id } = body;

        if (!name) {
            return NextResponse.json({
                success: false,
                error: 'الاسم مطلوب',
            }, { status: 400, headers: CORS });
        }

        const finalSlug = slug || name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
        const finalTenantId = tenant_id || 1;

        const result = await db
            .prepare(`
                INSERT INTO applications (
                    name, slug, description, version, status,
                    tenant_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                name,
                finalSlug,
                description || null,
                version || '1.0.0',
                status || 'active',
                finalTenantId
            )
            .run();

        const newApp = await db
            .prepare('SELECT * FROM applications WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        // ✅ إنشاء جدول storage للعميل تلقائياً
        if (finalTenantId) {
            try {
                const schemaName = `tenant_${finalTenantId}`;
                await db
                    .prepare(`
                        CREATE TABLE IF NOT EXISTS ${schemaName}.storage (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            file_name TEXT NOT NULL,
                            file_path TEXT NOT NULL,
                            file_size INTEGER,
                            file_type TEXT,
                            folder TEXT,
                            company_id TEXT,
                            table_name TEXT,
                            record_id TEXT,
                            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                        )
                    `)
                    .run();
                console.log(`✅ Created storage table for tenant ${finalTenantId}`);
            } catch (err) {
                console.log(`⚠️ Storage table for tenant ${finalTenantId} already exists or error:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            data: newApp.results?.[0] || null,
            message: 'تم إضافة التطبيق بنجاح مع إنشاء جدول التخزين',
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ POST applications error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل إضافة التطبيق',
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
                error: 'معرف التطبيق مطلوب',
            }, { status: 400, headers: CORS });
        }

        await db
            .prepare('DELETE FROM applications WHERE id = ?')
            .bind(id)
            .run();

        return NextResponse.json({
            success: true,
            message: 'تم حذف التطبيق بنجاح',
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ DELETE applications error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل حذف التطبيق',
        }, { status: 500, headers: CORS });
    }
}