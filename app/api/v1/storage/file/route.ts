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

const SCHEMA = 'tenant_a0000000_0000_0000_0000_000000000001';
const COMPANY_ID = 'b15d3621-2b47-42c8-af9d-d109b900829e';

// ✅ الوصول إلى R2 عبر getCloudflareContext (الطريقة الصحيحة في OpenNext)
async function getBucket() {
  const { env } = await getCloudflareContext();
  const bucket = (env as any).STORAGE;
  if (!bucket) {
    throw new Error('R2 STORAGE binding is not configured');
  }
  return bucket as R2Bucket;
}

const contentTypes: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.bmp': 'image/bmp', '.ico': 'image/x-icon', '.tiff': 'image/tiff',
  '.apk': 'application/vnd.android.package-archive',
  '.aab': 'application/octet-stream', '.ipa': 'application/octet-stream',
  '.exe': 'application/x-msdownload', '.msi': 'application/x-msi',
  '.dmg': 'application/x-apple-diskimage', '.pkg': 'application/x-newton-compatible-pkg',
  '.pdf': 'application/pdf', '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.txt': 'text/plain', '.csv': 'text/csv',
  '.mp4': 'video/mp4', '.avi': 'video/x-msvideo', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
  '.zip': 'application/zip', '.rar': 'application/vnd.rar',
  '.7z': 'application/x-7z-compressed',
  '.json': 'application/json', '.xml': 'application/xml',
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('id');

    // ✅ تحميل ملف محدد
    if (fileId) {
      const records = await dbQuery(
        `SELECT * FROM ${SCHEMA}.storage WHERE id = $1`,
        [fileId]
      );

      if (!records || records.length === 0) {
        return NextResponse.json({ error: 'File not found' }, { status: 404, headers: CORS_HEADERS });
      }

      const fileRecord = records[0];
      const bucket = await getBucket();

      // ✅ جلب الملف من R2
      const object = await bucket.get(fileRecord.file_path);

      if (!object) {
        return NextResponse.json({ error: 'File not found in R2' }, { status: 404, headers: CORS_HEADERS });
      }

      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Content-Disposition', `attachment; filename="${fileRecord.file_name}"`);
      headers.set('Cache-Control', 'public, max-age=31536000');
      Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v));

      return new NextResponse(object.body, { status: 200, headers });
    }

    // ✅ قائمة جميع الملفات
    const files = await dbQuery(`SELECT * FROM ${SCHEMA}.storage ORDER BY created_at DESC`);
    return NextResponse.json({ success: true, data: files }, { headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: CORS_HEADERS });
    }

    const bucket = await getBucket();

    // ✅ رفع الملف إلى R2
    const fileName = `${Date.now()}_${file.name}`;
    await bucket.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    // ✅ حفظ بيانات الملف في D1
    const query = `
      INSERT INTO ${SCHEMA}.storage (file_name, file_path, file_size, file_type, folder, company_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await dbQuery(query, [
      file.name,
      fileName,
      file.size,
      file.type || 'application/octet-stream',
      'uploads',
      COMPANY_ID,
    ]);

    const downloadUrl = `/api/v1/storage?id=${result[0].id}`;

    return NextResponse.json(
      { success: true, data: result[0], url: downloadUrl },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS_HEADERS });
    }

    const records = await dbQuery(`SELECT * FROM ${SCHEMA}.storage WHERE id = $1`, [id]);

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const fileRecord = records[0];
    const bucket = await getBucket();

    // ✅ حذف الملف من R2
    try {
      await bucket.delete(fileRecord.file_path);
    } catch {
      // الملف قد لا يكون موجوداً في R2
    }

    // ✅ حذف السجل من D1
    await dbQuery(`DELETE FROM ${SCHEMA}.storage WHERE id = $1`, [id]);

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
