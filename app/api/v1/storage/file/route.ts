import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

async function getBucket() {
    const { env } = await getCloudflareContext();
    const bucket = (env as any).STORAGE;
    if (!bucket) throw new Error('R2 STORAGE binding is not configured');
    return bucket as R2Bucket;
}

// ✅ POST - رفع ملف
export async function POST(req: NextRequest) {
    try {
        const { env } = await getCloudflareContext();
        const db = await getDb(env);

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const tenantId = formData.get('tenant_id') as string || '1';
        const folder = formData.get('folder') as string || '/';

        if (!file) {
            return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400, headers: CORS });
        }

        if (file.size > 50 * 1024 * 1024) {
            return NextResponse.json({ error: 'حجم الملف يتجاوز 50 ميغابايت' }, { status: 400, headers: CORS });
        }

        const bucket = await getBucket();
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const r2Key = folder && folder !== '/' 
            ? `${folder}/${fileName}` 
            : fileName;

        await bucket.put(r2Key, file.stream(), {
            httpMetadata: {
                contentType: file.type || 'application/octet-stream',
            },
        });

        const filePath = `/storage/${folder}/${fileName}`;

        const result = await db
            .prepare(`
                INSERT INTO storage (
                    tenant_id, file_name, file_path, file_size,
                    file_type, folder, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `)
            .bind(
                tenantId,
                fileName,
                r2Key,
                file.size,
                file.type || 'unknown',
                folder || '/'
            )
            .run();

        const fileId = result.meta?.last_row_id || 0;

        const imageUrl = `https://cloud.madartech.uk/api/v1/storage?id=${fileId}`;

        return NextResponse.json({
            success: true,
            data: {
                id: fileId,
                url: imageUrl,
                path: filePath,
                fileName: fileName,
                size: file.size,
                type: file.type,
                folder: folder
            },
            message: 'تم رفع الملف بنجاح'
        }, { status: 201, headers: CORS });

    } catch (error: any) {
        console.error('❌ Upload Error:', error);
        return NextResponse.json({ error: error.message || 'فشل رفع الملف' }, { status: 500, headers: CORS });
    }
}

// ✅ GET - جلب ملف أو قائمة ملفات
export async function GET(req: NextRequest) {
    try {
        const { env } = await getCloudflareContext();
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        const download = url.searchParams.get('download');
        const tenantId = url.searchParams.get('tenant_id') || '1';

        if (id) {
            const result = await db
                .prepare('SELECT * FROM storage WHERE id = ?')
                .bind(id)
                .all();

            if (!result.results || result.results.length === 0) {
                return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404, headers: CORS });
            }

            const file = result.results[0] as any;

            // ✅ أولاً: حاول R2 (الملفات الجديدة)
            const bucket = await getBucket();
            const object = await bucket.get(file.file_path);

            if (object) {
                const headers = new Headers();
                object.writeHttpMetadata(headers);
                headers.set('Cache-Control', 'public, max-age=31536000');

                if (download === 'true') {
                    headers.set('Content-Disposition', `attachment; filename="${file.file_name}"`);
                } else {
                    headers.set('Content-Disposition', `inline; filename="${file.file_name}"`);
                }

                return new Response(object.body, { headers });
            }

            // ✅ ثانياً: إذا لم يوجد في R2، حاول base64 من D1 (الصور القديمة)
            if (file.file_data) {
                const base64Data = file.file_data;
                const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
                const headers = new Headers();
                headers.set('Content-Type', file.file_type || 'image/jpeg');
                headers.set('Cache-Control', 'public, max-age=31536000');
                headers.set('Content-Disposition', `inline; filename="${file.file_name}"`);

                return new Response(buffer, { headers });
            }

            return NextResponse.json({ error: 'الملف غير موجود في التخزين' }, { status: 404, headers: CORS });
        }

        const result = await db
            .prepare('SELECT id, tenant_id, file_name, file_path, file_size, file_type, folder, created_at FROM storage ORDER BY created_at DESC')
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || []
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ GET Error:', error);
        return NextResponse.json({ error: error.message || 'فشل جلب الملفات' }, { status: 500, headers: CORS });
    }
}

// ✅ DELETE - حذف ملف
export async function DELETE(req: NextRequest) {
    try {
        const { env } = await getCloudflareContext();
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');

        if (!id) {
            return NextResponse.json({ error: 'معرف الملف مطلوب' }, { status: 400, headers: CORS });
        }

        const result = await db
            .prepare('SELECT * FROM storage WHERE id = ?')
            .bind(id)
            .all();

        if (result.results && result.results.length > 0) {
            const file = result.results[0] as any;
            const bucket = await getBucket();
            try {
                await bucket.delete(file.file_path);
            } catch {}
        }

        await db
            .prepare('DELETE FROM storage WHERE id = ?')
            .bind(id)
            .run();

        return NextResponse.json({
            success: true,
            message: 'تم حذف الملف بنجاح'
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ DELETE Error:', error);
        return NextResponse.json({ error: error.message || 'فشل حذف الملف' }, { status: 500, headers: CORS });
    }
}
