import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';
import { generateApiKey, hashApiKey, getKeyPrefix } from '@/lib/auth/api-key';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

// ✅ GET - جلب جميع مفاتيح API
export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const result = await db
            .prepare(`
                SELECT 
                    ak.id,
                    ak.name,
                    ak.key_prefix,
                    ak.tenant_id,
                    ak.application_id,
                    ak.permissions,
                    ak.status,
                    ak.expires_at,
                    ak.last_used_at,
                    ak.created_at,
                    t.name as tenant_name,
                    a.name as application_name
                FROM api_keys ak
                LEFT JOIN tenants t ON ak.tenant_id = t.id
                LEFT JOIN applications a ON ak.application_id = a.id
                ORDER BY ak.created_at DESC
            `)
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || [],
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ GET api-keys error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل جلب مفاتيح API',
        }, { status: 500, headers: CORS });
    }
}

// ✅ POST - إنشاء مفتاح API جديد
export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const body = await req.json();

        const { tenant_id, application_id, name, expires_at } = body;

        if (!tenant_id || !name) {
            return NextResponse.json({
                success: false,
                error: 'tenant_id و name مطلوبان',
            }, { status: 400, headers: CORS });
        }

        // إنشاء مفتاح API
        const apiKey = generateApiKey();
        const keyHash = hashApiKey(apiKey);
        const keyPrefix = getKeyPrefix(apiKey);

        const result = await db
            .prepare(`
                INSERT INTO api_keys (
                    tenant_id, application_id, name,
                    key_prefix, key_hash, permissions,
                    status, expires_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                tenant_id,
                application_id || null,
                name,
                keyPrefix,
                keyHash,
                JSON.stringify({ read: true, write: true }),
                'active',
                expires_at || null
            )
            .run();

        // ✅ إنشاء جدول storage للعميل تلقائياً
        try {
            const schemaName = `tenant_${tenant_id}`;
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
            console.log(`✅ Created storage table for tenant ${tenant_id}`);
        } catch (err) {
            console.log(`⚠️ Storage table for tenant ${tenant_id} already exists or error:`, err);
        }

        const newKey = await db
            .prepare('SELECT * FROM api_keys WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        return NextResponse.json({
            success: true,
            data: newKey.results?.[0] || null,
            meta: {
                full_key: apiKey,
                key_prefix: keyPrefix,
            },
            message: 'تم إنشاء مفتاح API بنجاح مع جدول التخزين',
        }, { status: 201, headers: CORS });

    } catch (error: any) {
        console.error('❌ POST api-keys error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل إنشاء مفتاح API',
        }, { status: 500, headers: CORS });
    }
}

// ✅ PUT - تحديث مفتاح API
export async function PUT(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        const body = await req.json();

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'id مطلوب',
            }, { status: 400, headers: CORS });
        }

        const { name, permissions, status, expires_at } = body;

        let sql = 'UPDATE api_keys SET updated_at = datetime("now")';
        const params: any[] = [];

        if (name !== undefined) {
            sql += ', name = ?';
            params.push(name);
        }
        if (permissions !== undefined) {
            sql += ', permissions = ?';
            params.push(JSON.stringify(permissions));
        }
        if (status !== undefined) {
            sql += ', status = ?';
            params.push(status);
        }
        if (expires_at !== undefined) {
            sql += ', expires_at = ?';
            params.push(expires_at);
        }

        sql += ' WHERE id = ?';
        params.push(id);

        await db
            .prepare(sql)
            .bind(...params)
            .run();

        const updated = await db
            .prepare('SELECT * FROM api_keys WHERE id = ?')
            .bind(id)
            .all();

        return NextResponse.json({
            success: true,
            data: updated.results?.[0] || null,
            message: 'تم تحديث مفتاح API بنجاح',
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ PUT api-keys error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل تحديث مفتاح API',
        }, { status: 500, headers: CORS });
    }
}

// ✅ DELETE - حذف مفتاح API
export async function DELETE(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'id مطلوب',
            }, { status: 400, headers: CORS });
        }

        await db
            .prepare('DELETE FROM api_keys WHERE id = ?')
            .bind(id)
            .run();

        return NextResponse.json({
            success: true,
            message: 'تم حذف مفتاح API بنجاح',
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ DELETE api-keys error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل حذف مفتاح API',
        }, { status: 500, headers: CORS });
    }
}