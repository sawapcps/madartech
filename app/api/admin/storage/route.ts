/*
 * Admin API - Storage Files
 * GET  /api/admin/storage - list files (optional ?tenant_id= filter)
 * POST /api/admin/storage - create file metadata record
 * DELETE /api/admin/storage?id= - delete file record
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbInsert, dbDelete } from '@/lib/db/driver';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');

    let sql = `SELECT sf.*, t.name as tenant_name FROM storage_files sf JOIN tenants t ON sf.tenant_id = t.id`;
    const params: string[] = [];
    if (tenantId) {
      sql += ` WHERE sf.tenant_id = $1`;
      params.push(tenantId);
    }
    sql += ` ORDER BY sf.created_at DESC`;

    const files = await dbQuery(sql, params);
    return NextResponse.json({ success: true, data: files }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, file_name, file_type, size_bytes, folder } = body;

    if (!tenant_id || !file_name) {
      return NextResponse.json({ error: 'tenant_id and file_name are required' }, { status: 400, headers: CORS });
    }

    const file = await dbInsert('storage_files', {
      tenant_id,
      file_name,
      file_path: `${tenant_id}/${folder || '/'}${file_name}`,
      file_type: file_type || null,
      size_bytes: size_bytes || 0,
      folder: folder || '/',
      storage_provider: 'minio',
    });

    return NextResponse.json({ success: true, data: file }, { status: 201, headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS });

    const count = await dbDelete('storage_files', { id });
    if (count === 0) return NextResponse.json({ error: 'File not found' }, { status: 404, headers: CORS });

    return NextResponse.json({ success: true }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}