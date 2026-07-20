import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';
import path from 'path';
import fs from 'fs/promises';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BACKUP_DIR = path.join(process.cwd(), 'backups');

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

// ✅ GET - جلب النسخ الاحتياطية
export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const tenantId = url.searchParams.get('tenant_id');
        const id = url.searchParams.get('id');
        const download = url.searchParams.get('download');

        // تحميل ملف
        if (id && download === 'true') {
            const backup = await db
                .prepare('SELECT * FROM backups WHERE id = ?')
                .bind(id)
                .all();

            if (!backup.results || backup.results.length === 0) {
                return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
            }

            const filePath = path.join(BACKUP_DIR, backup.results[0].filename);
            try {
                const fileContent = await fs.readFile(filePath);
                return new NextResponse(fileContent, {
                    status: 200,
                    headers: {
                        ...CORS,
                        'Content-Type': 'application/json',
                        'Content-Disposition': `attachment; filename="${backup.results[0].filename}"`,
                    },
                });
            } catch {
                return NextResponse.json({ error: 'Backup file not found' }, { status: 404, headers: CORS });
            }
        }

        // جلب قائمة النسخ
        let sql = 'SELECT * FROM backups';
        const params: string[] = [];

        if (tenantId) {
            sql += ' WHERE tenant_id = ?';
            params.push(tenantId);
        }

        sql += ' ORDER BY created_at DESC';

        const result = await db
            .prepare(sql)
            .bind(...params)
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || []
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

        const { tenant_id, client_id, schedule, note } = body;

        const idValue = tenant_id || client_id;
        if (!idValue) {
            return NextResponse.json({ error: 'tenant_id or client_id is required' }, { status: 400, headers: CORS });
        }

        // إنشاء مجلد backups
        try {
            await fs.mkdir(BACKUP_DIR, { recursive: true });
        } catch (err) {
            console.error('❌ Failed to create backup directory:', err);
        }

        // جلب بيانات العميل
        const tenant = await db
            .prepare('SELECT name, email FROM tenants WHERE id = ?')
            .bind(idValue)
            .all();

        // جمع البيانات من الجداول
        const tables = ['customers', 'products', 'sales', 'invoice_items'];
        const backupData: any = {
            tenant_id: idValue,
            tenant_name: tenant.results?.[0]?.name || 'Unknown',
            exported_at: new Date().toISOString(),
            version: '1.0',
            tables: {}
        };

        for (const table of tables) {
            try {
                const result = await db
                    .prepare(`SELECT * FROM ${table} WHERE tenant_id = ?`)
                    .bind(idValue)
                    .all();
                backupData.tables[table] = result.results || [];
            } catch {
                backupData.tables[table] = [];
            }
        }

        // حفظ الملف
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `backup_${idValue}_${timestamp}.json`;
        const filePath = path.join(BACKUP_DIR, filename);

        await fs.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
        const fileSize = (await fs.stat(filePath)).size;

        // تسجيل في قاعدة البيانات
        const result = await db
            .prepare(`
                INSERT INTO backups (
                    tenant_id, client_id, type, status, schedule,
                    size_bytes, filename, note, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                idValue,
                client_id || null,
                body.type || 'manual',
                'completed',
                schedule || 'none',
                fileSize,
                filename,
                note || null
            )
            .run();

        const newBackup = await db
            .prepare('SELECT * FROM backups WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        return NextResponse.json({
            success: true,
            data: newBackup.results?.[0] || null,
            download_url: `/api/admin/backups?id=${result.meta?.last_row_id || 0}&download=true`
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

        const backup = await db
            .prepare('SELECT * FROM backups WHERE id = ?')
            .bind(id)
            .all();

        if (!backup.results || backup.results.length === 0) {
            return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
        }

        // حذف الملف
        try {
            const filePath = path.join(BACKUP_DIR, backup.results[0].filename);
            await fs.unlink(filePath);
        } catch {}

        // حذف السجل
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