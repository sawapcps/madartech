import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';
import path from 'path';
import fs from 'fs/promises';

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
const STORAGE_DIR = path.join(process.cwd(), 'storage', 'uploads');

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
      const filePath = path.join(STORAGE_DIR, fileRecord.file_name);

      try {
        await fs.access(filePath);
      } catch {
        return NextResponse.json({ error: 'File not found on disk' }, { status: 404, headers: CORS_HEADERS });
      }

      const fileBuffer = await fs.readFile(filePath);

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

      const ext = path.extname(fileRecord.file_name).toLowerCase();
      const contentType = contentTypes[ext] || 'application/octet-stream';

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileRecord.file_name}"`,
          'Cache-Control': 'public, max-age=31536000',
          ...CORS_HEADERS,
        },
      });
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

    // ✅ إنشاء مجلد التخزين إذا لم يكن موجوداً
    try {
      await fs.mkdir(STORAGE_DIR, { recursive: true });
    } catch {
      // المجلد موجود بالفعل
    }

    // ✅ حفظ الملف فعلياً على القرص
    const fileName = `${Date.now()}_${file.name}`;
    const filePath = path.join(STORAGE_DIR, fileName);
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    await fs.writeFile(filePath, buffer);

    // ✅ حفظ بيانات الملف في قاعدة البيانات
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

    // ✅ جلب بيانات الملف قبل الحذف
    const records = await dbQuery(`SELECT * FROM ${SCHEMA}.storage WHERE id = $1`, [id]);

    if (!records || records.length === 0) {
      return NextResponse.json({ error: 'File not found' }, { status: 404, headers: CORS_HEADERS });
    }

    // ✅ حذف الملف من القرص
    const fileRecord = records[0];
    try {
      const filePath = path.join(STORAGE_DIR, fileRecord.file_path);
      await fs.unlink(filePath);
    } catch {
      // الملف قد لا يكون موجوداً على القرص
    }

    // ✅ حذف السجل من قاعدة البيانات
    await dbQuery(`DELETE FROM ${SCHEMA}.storage WHERE id = $1`, [id]);

    return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
