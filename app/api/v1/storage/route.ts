import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

// ✅ POST - رفع ملف/صورة
export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        const formData = await req.formData();
        const file = formData.get('file') as File;
        const tenantId = formData.get('tenant_id') as string || '1';
        const folder = formData.get('folder') as string || '/';

        if (!file) {
            return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400, headers: CORS });
        }

        // التحقق من نوع الملف (صور فقط)
        const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml'];
        if (!allowedTypes.includes(file.type)) {
            return NextResponse.json({ error: 'نوع الملف غير مدعوم. يرجى رفع صورة' }, { status: 400, headers: CORS });
        }

        // التحقق من الحجم (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return NextResponse.json({ error: 'حجم الصورة يتجاوز 5 ميغابايت' }, { status: 400, headers: CORS });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const base64Data = buffer.toString('base64');

        // إنشاء اسم فريد للملف
        const timestamp = Date.now();
        const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const filePath = `/storage/${folder}/${fileName}`;

        const result = await db
            .prepare(`
                INSERT INTO tenant_${tenantId}.storage (
                    file_name, file_path, file_size, file_type,
                    folder, file_data, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
            `)
            .bind(
                fileName,
                filePath,
                file.size,
                file.type || 'unknown',
                folder || '/',
                base64Data
            )
            .run();

        const fileId = result.meta?.last_row_id || 0;

        // رابط الصورة
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

// ✅ GET - جلب ملف أو قائمة الملفات
export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        const tenantId = url.searchParams.get('tenant_id') || '1';

        // جلب ملف محدد بالمعرف
        if (id) {
            const result = await db
                .prepare(`SELECT * FROM tenant_${tenantId}.storage WHERE id = ?`)
                .bind(id)
                .all();

            if (!result.results || result.results.length === 0) {
                return NextResponse.json({ error: 'الملف غير موجود' }, { status: 404, headers: CORS });
            }

            const file = result.results[0] as any;
            const fileData = Buffer.from(file.file_data || '', 'base64');

            // ✅ استخدام Response بدلاً من NextResponse للملفات
            const isImage = file.file_type?.startsWith('image/');
            
            if (isImage) {
                return new Response(fileData, {
                    headers: {
                        'Content-Type': file.file_type || 'image/png',
                        'Cache-Control': 'public, max-age=31536000',
                    },
                });
            }

            // تحميل الملف
            return new Response(fileData, {
                headers: {
                    'Content-Type': file.file_type || 'application/octet-stream',
                    'Content-Disposition': `attachment; filename="${file.file_name}"`,
                },
            });
        }

        // جلب قائمة الملفات
        const result = await db
            .prepare(`SELECT id, file_name, file_path, file_size, file_type, folder, created_at FROM tenant_${tenantId}.storage ORDER BY created_at DESC`)
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
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const url = new URL(req.url);
        const id = url.searchParams.get('id');
        const tenantId = url.searchParams.get('tenant_id') || '1';

        if (!id) {
            return NextResponse.json({ error: 'معرف الملف مطلوب' }, { status: 400, headers: CORS });
        }

        await db
            .prepare(`DELETE FROM tenant_${tenantId}.storage WHERE id = ?`)
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