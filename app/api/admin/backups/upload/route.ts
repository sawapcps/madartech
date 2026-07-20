import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const formData = await req.formData();
        const file = formData.get('file') as File | null;
        const tenantId = formData.get('tenant_id') as string;
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

        const buffer = Buffer.from(await file.arrayBuffer());
        let backupData;
        try {
            backupData = JSON.parse(buffer.toString('utf-8'));
        } catch {
            return NextResponse.json(
                { error: 'الملف ليس بصيغة JSON صالحة' },
                { status: 400, headers: CORS }
            );
        }

        // التحقق من وجود tenant_id في البيانات
        const dataTenantId = backupData.tenant_id || backupData.client_id;
        if (!dataTenantId) {
            return NextResponse.json(
                { error: 'الملف لا يحتوي على tenant_id صالح' },
                { status: 400, headers: CORS }
            );
        }

        // ✅ تخزين البيانات في قاعدة البيانات
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `uploaded_${tenantId}_${timestamp}.json`;
        const backupDataString = JSON.stringify(backupData);
        const fileSize = backupDataString.length;

        const result = await db
            .prepare(`
                INSERT INTO backups (
                    tenant_id, client_id, type, status, schedule,
                    size_bytes, filename, note, backup_data, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
            `)
            .bind(
                tenantId,
                tenantId,
                'upload',
                'uploaded',
                'none',
                fileSize,
                filename,
                note || null,
                backupDataString
            )
            .run();

        const newBackup = await db
            .prepare('SELECT * FROM backups WHERE id = ?')
            .bind(result.meta?.last_row_id || 0)
            .all();

        return NextResponse.json({
            success: true,
            data: newBackup.results?.[0] || null,
            message: 'تم رفع الملف بنجاح'
        }, { status: 201, headers: CORS });

    } catch (err: any) {
        console.error('❌ Upload Error:', err);
        return NextResponse.json(
            { error: err.message || 'حدث خطأ أثناء رفع الملف' },
            { status: 500, headers: CORS }
        );
    }
}