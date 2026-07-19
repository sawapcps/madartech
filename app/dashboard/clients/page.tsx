import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

// ============================================================
// ✅ CORS Headers
// ============================================================
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

// ============================================================
// ✅ GET - جلب جميع العملاء
// ============================================================
export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const result = await db
            .prepare('SELECT id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes, created_at, updated_at FROM tenants ORDER BY created_at DESC')
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || [],
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ GET /api/admin/tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل جلب العملاء',
        }, { status: 500, headers: CORS });
    }
}

// ============================================================
// ✅ POST - إضافة عميل جديد
// ============================================================
export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const body = await req.json();
        console.log('📥 POST /api/admin/tenants - body:', body);

        // 🔍 التحقق من وجود action (للتحديث)
        if (body.action === 'update') {
            return await handleUpdate(req, body);
        }

        // ✅ إضافة عميل جديد
        const { name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes } = body;

        // التحقق من الحقول المطلوبة
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

        // إنشاء API Key فريد
        const apiKey = `key_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // إدراج العميل الجديد
        const result = await db
            .prepare(`
        INSERT INTO tenants (
          name, email, phone, company, status,
          storage_limit_mb, db_limit_mb, api_key, notes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
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
                notes || null
            )
            .run();

        // جلب العميل المُضاف
        const newClient = await db
            .prepare('SELECT id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes, created_at FROM tenants WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        console.log('✅ تم إضافة العميل بنجاح:', newClient.results?.[0]);

        return NextResponse.json({
            success: true,
            data: newClient.results?.[0] || null,
            message: 'تم إضافة العميل بنجاح',
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ POST /api/admin/tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل إضافة العميل',
        }, { status: 500, headers: CORS });
    }
}

// ============================================================
// ✅ PUT - تحديث عميل
// ============================================================
export async function PUT(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const body = await req.json();
        console.log('📥 PUT /api/admin/tenants - body:', body);

        const { id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes } = body;

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'معرف العميل مطلوب',
            }, { status: 400, headers: CORS });
        }

        // التحقق من وجود العميل
        const existing = await db
            .prepare('SELECT id FROM tenants WHERE id = ?')
            .bind(id)
            .all();

        if (!existing.results || existing.results.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'العميل غير موجود',
            }, { status: 404, headers: CORS });
        }

        // تحديث العميل
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

        // جلب العميل المُحدث
        const updatedClient = await db
            .prepare('SELECT id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes, created_at, updated_at FROM tenants WHERE id = ?')
            .bind(id)
            .all();

        console.log('✅ تم تحديث العميل بنجاح:', updatedClient.results?.[0]);

        return NextResponse.json({
            success: true,
            data: updatedClient.results?.[0] || null,
            message: 'تم تحديث العميل بنجاح',
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ PUT /api/admin/tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل تحديث العميل',
        }, { status: 500, headers: CORS });
    }
}

// ============================================================
// ✅ DELETE - حذف عميل
// ============================================================
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

        // التحقق من وجود العميل
        const existing = await db
            .prepare('SELECT id FROM tenants WHERE id = ?')
            .bind(id)
            .all();

        if (!existing.results || existing.results.length === 0) {
            return NextResponse.json({
                success: false,
                error: 'العميل غير موجود',
            }, { status: 404, headers: CORS });
        }

        // حذف العميل
        await db
            .prepare('DELETE FROM tenants WHERE id = ?')
            .bind(id)
            .run();

        console.log('✅ تم حذف العميل بنجاح:', id);

        return NextResponse.json({
            success: true,
            message: 'تم حذف العميل بنجاح',
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ DELETE /api/admin/tenants error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل حذف العميل',
        }, { status: 500, headers: CORS });
    }
}

// ============================================================
// ✅ handleUpdate - معالجة التحديث عبر POST (للتوافق مع الواجهة)
// ============================================================
async function handleUpdate(req: NextRequest, body: any) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const { id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes } = body;

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'معرف العميل مطلوب',
            }, { status: 400, headers: CORS });
        }

        // تحديث العميل
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

        // جلب العميل المُحدث
        const updatedClient = await db
            .prepare('SELECT id, name, email, phone, company, status, storage_limit_mb, db_limit_mb, notes, created_at, updated_at FROM tenants WHERE id = ?')
            .bind(id)
            .all();

        console.log('✅ تم تحديث العميل بنجاح (via POST action):', updatedClient.results?.[0]);

        return NextResponse.json({
            success: true,
            data: updatedClient.results?.[0] || null,
            message: 'تم تحديث العميل بنجاح',
        }, { headers: CORS });

    } catch (error) {
        console.error('❌ handleUpdate error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'فشل تحديث العميل',
        }, { status: 500, headers: CORS });
    }
}