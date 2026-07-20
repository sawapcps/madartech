import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';
import path from 'path';
import fs from 'fs/promises';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BACKUP_DIR = path.join(process.cwd(), 'backups');

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
    let tenantId = '';
    let file: File | null = null;
    let buffer: Buffer | null = null;
    let filename = '';

    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const formData = await req.formData();
        file = formData.get('file') as File | null;
        tenantId = formData.get('tenant_id') as string;
        const note = formData.get('note') as string || 'تم الرفع من ملف خارجي';

        if (!file || !tenantId) {
            return NextResponse.json(
                { error: 'الملف و tenant_id مطلوبان' },
                { status: 400, headers: CORS }
            );
        }

        if (!file.name.endsWith('.json')) {
            return NextResponse.json(
                { error: 'يجب أن يكون الملف بصيغة JSON' },
                { status: 400, headers: CORS }
            );
        }

        await fs.mkdir(BACKUP_DIR, { recursive: true });

        buffer = Buffer.from(await file.arrayBuffer());
        try {
            JSON.parse(buffer.toString('utf-8'));
        } catch {
            return NextResponse.json(
                { error: 'الملف ليس بصيغة JSON صالحة' },
                { status: 400, headers: CORS }
            );
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        filename = `uploaded_${tenantId}_${timestamp}.json`;
        const filePath = path.join(BACKUP_DIR, filename);
        await fs.writeFile(filePath, buffer);
        const fileSize = (await fs.stat(filePath)).size;

        // ✅ إدراج السجل مباشرة في D1
        const result = await db
            .prepare(`
                INSERT INTO backups (
                    tenant_id, client_id, type, status, schedule,
                    size_bytes, filename, note, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                tenantId,
                tenantId,
                'manual',
                'completed',
                'none',
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
            message: 'تم رفع الملف بنجاح',
        }, { status: 201, headers: CORS });

    } catch (err: any) {
        console.error('❌ Upload Error:', err);

        // ✅ محاولة الإنقاذ بأقل عدد من الأعمدة
        try {
            if (buffer && tenantId) {
                const fallbackFilename = filename || `uploaded_${tenantId}_${Date.now()}.json`;
                const filePath = path.join(BACKUP_DIR, fallbackFilename);
                await fs.writeFile(filePath, buffer);
                const fileSize = (await fs.stat(filePath)).size;

                const env = (req as any).env || process.env;
                const db = await getDb(env);

                const result = await db
                    .prepare(`
                        INSERT INTO backups (
                            tenant_id, filename, size_bytes, type, status, created_at
                        ) VALUES (?, ?, ?, ?, ?, datetime('now'))
                    `)
                    .bind(tenantId, fallbackFilename, fileSize, 'manual', 'uploaded')
                    .run();

                const newBackup = await db
                    .prepare('SELECT * FROM backups WHERE id = ?')
                    .bind(result.meta?.last_row_id || 0)
                    .all();

                return NextResponse.json({
                    success: true,
                    data: newBackup.results?.[0] || null,
                    message: 'تم رفع الملف بنجاح',
                }, { status: 201, headers: CORS });
            }
        } catch (fallbackErr) {
            console.error('❌ Fallback insert failed:', fallbackErr);
        }

        return NextResponse.json(
            {
                error: err.message || 'حدث خطأ أثناء رفع الملف',
                detail: err.detail || err.code || undefined,
            },
            { status: 500, headers: CORS }
        );
    }
}