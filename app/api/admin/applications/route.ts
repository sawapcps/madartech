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

    } catch (error) {
        console.error('❌ GET applications error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل جلب التطبيقات',
        }, { status: 500, headers: CORS });
    }
}

export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const body = await req.json();

        console.log('📥 POST applications - body:', body);

        // ✅ معالجة التحديث (action: 'update')
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
                    slug,
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
        const { name, slug, description, version, status } = body;

        if (!name || !slug) {
            return NextResponse.json({
                success: false,
                error: 'الاسم والـ slug مطلوبان',
            }, { status: 400, headers: CORS });
        }

        // التحقق من عدم تكرار الـ slug
        const existing = await db
            .prepare('SELECT id FROM applications WHERE slug = ?')
            .bind(slug)
            .all();

        if (existing.results && existing.results.length > 0) {
            return NextResponse.json({
                success: false,
                error: 'الـ slug مستخدم بالفعل',
            }, { status: 409, headers: CORS });
        }

        const result = await db
            .prepare(`
                INSERT INTO applications (
                    name, slug, description, version, status,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                name,
                slug,
                description || null,
                version || '1.0.0',
                status || 'active'
            )
            .run();

        const newApp = await db
            .prepare('SELECT * FROM applications WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        return NextResponse.json({
            success: true,
            data: newApp.results?.[0] || null,
            message: 'تم إضافة التطبيق بنجاح',
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ POST applications error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل إضافة التطبيق',
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

    } catch (error) {
        console.error('❌ DELETE applications error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل حذف التطبيق',
        }, { status: 500, headers: CORS });
    }
}