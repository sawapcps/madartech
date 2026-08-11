import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('image') as File;
    const category = (formData.get('category') as string) || 'general';
    const tableName = (formData.get('table_name') as string) || null;
    const recordId = (formData.get('record_id') as string) || null;
    const tenantId = (formData.get('tenant_id') as string) || '1';

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400, headers: CORS });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({
        error: 'Only images are allowed (JPEG, PNG, GIF, WEBP, SVG)'
      }, { status: 400, headers: CORS });
    }

    // ✅ رفع إلى R2
    const bucket = await getBucket();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const fileName = `${timestamp}_${safeName}`;
    const r2Key = category && category !== 'general'
      ? `${category}/${fileName}`
      : fileName;

    await bucket.put(r2Key, file.stream(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // ✅ إدراج في D1 مع tenant_id
    const query = `
      INSERT INTO storage (tenant_id, file_name, file_path, file_size, file_type, folder, table_name, record_id, company_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      RETURNING *
    `;

    const result = await dbQuery(query, [
      tenantId,
      file.name,
      r2Key,
      file.size,
      file.type,
      category,
      tableName,
      recordId,
      tenantId,
    ]);

    const fileId = (result[0] as any).id;
    const imageUrl = `https://cloud.madartech.uk/api/v1/storage?id=${fileId}`;

    return NextResponse.json({
      success: true,
      data: {
        id: fileId,
        url: imageUrl,
        path: imageUrl,
        fileName: file.name,
        size: file.size,
        category: category,
        createdAt: (result[0] as any).created_at
      }
    }, { status: 201, headers: CORS });

  } catch (error: any) {
    console.error('❌ Image Upload Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS });
  }
}
