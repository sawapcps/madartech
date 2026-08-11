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
      const bucket = await getBucket();
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

    const files = await dbQuery(`SELECT * FROM storage ORDER BY created_at DESC`);
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
    const fileName = `${Date.now()}_${file.name}`;
    await bucket.put(fileName, file.stream(), {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
      },
    });

    const query = `
      INSERT INTO storage (file_name, file_path, file_size, file_type, folder, company_id)
      VALUES (?, ?, ?, ?, ?, ?)
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

    const downloadUrl = `/api/v1/storage?id=${(result[0] as any).id}`;

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
