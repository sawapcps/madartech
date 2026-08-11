import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
}

const COMPANY_ID = 'b15d3621-2b47-42c8-af9d-d109b900829e';

async function getBucket() {
  const { env } = await getCloudflareContext();
  const bucket = (env as any).STORAGE;
  if (!bucket) throw new Error('R2 STORAGE binding is not configured');
  return bucket as R2Bucket;
}

// ✅ GET - جلب ملف أو قائمة الملفات
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    if (fileId) {
      const records = await dbQuery(
        `SELECT * FROM storage WHERE id = ?`,
        [fileId]
      );

      if (!records || records.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404, headers: CORS_HEADERS });
      }

      const fileRecord = records[0] as any;

      // ✅ أولاً: حاول R2
      const bucket = await getBucket();
      const object = await bucket.get(fileRecord.file_path);

      if (object) {
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Content-Disposition', `attachment; filename="${fileRecord.file_name}"`);
        headers.set('Cache-Control', 'public, max-age=31536000');
        Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

        return new NextResponse(object.body, { status: 200, headers });
      }

      // ✅ ثانياً: إذا لم يوجد في R2، حاول base64 من D1 (الصور القديمة)
      if (fileRecord.file_data) {
        const base64Data = fileRecord.file_data;
        const buffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
        const headers = new Headers();
        headers.set('Content-Type', fileRecord.file_type || 'image/jpeg');
        headers.set('Cache-Control', 'public, max-age=31536000');
        headers.set('Content-Disposition', `inline; filename="${fileRecord.file_name}"`);
        Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

        return new NextResponse(buffer, { status: 200, headers });
      }

      return NextResponse.json({ error: 'File not found in R2' }, { status: 404, headers: CORS_HEADERS });
    }

    const files = await dbQuery(`SELECT * FROM storage ORDER BY created_at DESC`);
    return NextResponse.json({ success: true, data: files }, { headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}

// ✅ POST - رفع ملف (معدل)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'الملف مطلوب' }, { status: 400, headers: CORS_HEADERS });
    }

    // ✅ الحصول على tenant_id من المستخدم الحالي (من التوكن أو الجلسة)
    // يمكنك استخراجها من رأس الطلب (Authorization) أو من formData
    const tenantId = formData.get('tenant_id') as string || '1';
    const folder = formData.get('folder') as string || '/';

    // ✅ تحقق من حجم الملف
    if (file.size > 50 * 1024 * 1024) {
      return NextResponse.json({ error: 'حجم الملف يتجاوز 50 ميغابايت' }, { status: 400, headers: CORS_HEADERS });
    }

    // ✅ رفع الملف إلى R2
    const bucket = await getBucket();
    const timestamp = Date.now();
    const fileName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
    const r2Key = folder && folder !== '/' ? `${folder}/${fileName}` : fileName;

    await bucket.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    // ✅ إدراج في D1 مع التحقق من النجاح
    const query = `
      INSERT INTO storage (file_name, file_path, file_size, file_type, folder, company_id, tenant_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `;

    const result = await dbQuery(query, [
      file.name,
      r2Key,
      file.size,
      file.type || 'application/octet-stream',
      folder || '/',
      COMPANY_ID,
      parseInt(tenantId, 10), // ✅ تأكد من أن tenant_id رقم صحيح
    ]);

    // ✅ تحقق من أن الإدراج نجح
    if (!result || result.length === 0) {
      // ❌ إذا فشل الإدراج، احذف الملف من R2 (لتنظيف)
      await bucket.delete(r2Key).catch(() => {});
      return NextResponse.json(
        { error: 'فشل حفظ بيانات الملف في قاعدة البيانات' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const fileId = result[0].id;
    const downloadUrl = `/api/v1/storage?id=${fileId}`;

    return NextResponse.json(
      {
        success: true,
        data: {
          id: fileId,
          url: downloadUrl,
          fileName: fileName,
          size: file.size,
          type: file.type,
          folder: folder,
        },
        message: 'تم رفع الملف بنجاح',
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('❌ POST Error:', error);
    return NextResponse.json(
      { error: error.message || 'فشل رفع الملف' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

// ✅ DELETE - حذف ملف
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS_HEADERS });
    }

    const records = await dbQuery(`SELECT * FROM storage WHERE id = ?`, [id]);

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const fileRecord = records[0] as any;
    const bucket = await getBucket();

    try {
      await bucket.delete(fileRecord.file_path);
    } catch {}

    await dbQuery(`DELETE FROM storage WHERE id = ?`, [id]);

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
