import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

// ✅ GET - جلب النسخ الاحتياطية مع اسم العميل
export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const tenantId = url.searchParams.get('tenant_id');
        const id = url.searchParams.get('id');
        const download = url.searchParams.get('download');

        // ✅ تحميل ملف النسخة الاحتياطية
        if (id && download === 'true') {
            const result = await db
                .prepare('SELECT * FROM backups WHERE id = ?')
                .bind(id)
                .all();

            if (!result.results || result.results.length === 0) {
                return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
            }

            const backup = result.results[0] as any;
            const backupData = backup.backup_data || JSON.stringify({
                tenant_id: backup.tenant_id,
                exported_at: backup.created_at,
                version: '1.0',
                tables: {}
            });

            return new NextResponse(backupData, {
                status: 200,
                headers: {
                    ...CORS,
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="${backup.filename || `backup_${backup.id}.json`}"`,
                },
            });
        }

        // ✅ جلب نسخة واحدة بالمعرف (بدون تحميل)
        if (id) {
            const result = await db
                .prepare(`
                    SELECT b.*, t.name as tenant_name 
                    FROM backups b
                    LEFT JOIN tenants t ON b.tenant_id = t.id
                    WHERE b.id = ?
                `)
                .bind(id)
                .all();

            if (!result.results || result.results.length === 0) {
                return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
            }

            const backup = result.results[0] as any;
            
            return NextResponse.json({
                success: true,
                data: backup,
                backup_data: backup.backup_data ? JSON.parse(backup.backup_data) : null
            }, { headers: CORS });
        }

        // ✅ جلب قائمة النسخ مع اسم العميل
        let sql = `
            SELECT 
                b.id,
                b.tenant_id,
                b.client_id,
                b.filename,
                b.file_path,
                b.file_size,
                b.type,
                b.status,
                b.schedule,
                b.note,
                b.backup_data,
                b.created_at,
                b.updated_at,
                b.restored_at,
                b.restored_by,
                t.name as tenant_name
            FROM backups b
            LEFT JOIN tenants t ON b.tenant_id = t.id
        `;
        const params: string[] = [];

        if (tenantId) {
            sql += ' WHERE b.tenant_id = ?';
            params.push(tenantId);
        }

        sql += ' ORDER BY b.created_at DESC';

        const result = await db
            .prepare(sql)
            .bind(...params)
            .all();

        // ✅ تحويل البيانات للتوافق مع الواجهة (size_bytes بدلاً من file_size)
        const data = (result.results || []).map((row: any) => ({
            ...row,
            size_bytes: row.file_size || 0,
            client_name: row.tenant_name || 'غير معروف'
        }));

        return NextResponse.json({
            success: true,
            data: data
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ GET Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to fetch backups'
        }, { status: 500, headers: CORS });
    }
}

// ✅ POST - إنشاء نسخة احتياطية
export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const body = await req.json();

        const { tenant_id, schedule, note } = body;

        if (!tenant_id) {
            return NextResponse.json({
                error: 'tenant_id مطلوب'
            }, { status: 400, headers: CORS });
        }

        // ✅ التحقق من وجود العميل
        const tenant = await db
            .prepare('SELECT id, name FROM tenants WHERE id = ?')
            .bind(tenant_id)
            .all();

        if (!tenant.results || tenant.results.length === 0) {
            return NextResponse.json({
                error: 'العميل غير موجود'
            }, { status: 404, headers: CORS });
        }

        // ✅ جمع البيانات من الجداول
        const tables = ['customers', 'products', 'sales', 'invoice_items'];
        const backupData: any = {
            tenant_id: tenant_id,
            tenant_name: tenant.results[0].name,
            exported_at: new Date().toISOString(),
            version: '1.0',
            tables: {}
        };

        for (const table of tables) {
            try {
                const result = await db
                    .prepare(`SELECT * FROM ${table} WHERE tenant_id = ?`)
                    .bind(tenant_id)
                    .all();
                backupData.tables[table] = result.results || [];
            } catch {
                backupData.tables[table] = [];
            }
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${tenant_id}_${timestamp}.json`;
        const backupDataString = JSON.stringify(backupData);
        const fileSize = backupDataString.length;

        // ✅ تخزين البيانات مباشرة في قاعدة البيانات
        const result = await db
            .prepare(`
                INSERT INTO backups (
                    tenant_id, client_id, type, status, schedule,
                    file_size, filename, note, backup_data, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                tenant_id,
                tenant_id,
                'manual',
                'completed',
                schedule || 'none',
                fileSize,
                filename,
                note || null,
                backupDataString
            )
            .run();

        const newBackup = await db
            .prepare(`
                SELECT b.*, t.name as tenant_name 
                FROM backups b
                LEFT JOIN tenants t ON b.tenant_id = t.id
                WHERE b.id = ?
            `)
            .bind(result.meta?.last_row_id || 0)
            .all();

        return NextResponse.json({
            success: true,
            data: newBackup.results?.[0] || null,
            message: 'تم إنشاء النسخة الاحتياطية بنجاح'
        }, { status: 201, headers: CORS });

    } catch (error: any) {
        console.error('❌ POST Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to create backup'
        }, { status: 500, headers: CORS });
    }
}

// ✅ DELETE - حذف نسخة احتياطية
export async function DELETE(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS });
        }

        await db
            .prepare('DELETE FROM backups WHERE id = ?')
            .bind(id)
            .run();

        return NextResponse.json({
            success: true,
            message: '✅ Backup deleted successfully'
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ DELETE Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to delete backup'
        }, { status: 500, headers: CORS });
    }
}