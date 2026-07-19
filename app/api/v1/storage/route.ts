// F:\منصة ادارة بيانات التطبيقات السحابية\project\app\api\v1\storage\route.ts

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
  return new NextResponse(null, {
    status: 200,
    headers: CORS_HEADERS,
  });
}

const SCHEMA = 'tenant_a0000000_0000_0000_0000_000000000001';
const COMPANY_ID = 'b15d3621-2b47-42c8-af9d-d109b900829e';
const UPLOAD_DIR = path.join(process.cwd(), 'storage', 'uploads');

export async function GET() {
  try {
    const files = await dbQuery(`SELECT * FROM ${SCHEMA}.storage ORDER BY created_at DESC`);
    return NextResponse.json(
      { success: true, data: files },
      { headers: CORS_HEADERS }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // ✅ التأكد من وجود مجلد uploads
    try {
      await fs.access(UPLOAD_DIR);
    } catch {
      await fs.mkdir(UPLOAD_DIR, { recursive: true });
    }

    // ✅ حفظ الملف
    const fileName = `${Date.now()}_${file.name}`;
    const filePathPhysical = path.join(UPLOAD_DIR, fileName);
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePathPhysical, fileBuffer);

    // ✅ الرابط
    const fileUrl = `/api/v1/storage/file?filename=${encodeURIComponent(fileName)}&folder=uploads`;

    // ✅ تسجيل في قاعدة البيانات
    const query = `
      INSERT INTO ${SCHEMA}.storage (file_name, file_path, file_size, file_type, folder, company_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    
    const result = await dbQuery(query, [
      fileName,
      fileUrl,
      file.size,
      file.type || 'unknown',
      'uploads',
      COMPANY_ID
    ]);

    return NextResponse.json(
      { 
        success: true, 
        data: result[0], 
        url: fileUrl,
        message: 'تم رفع الملف بنجاح'
      },
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error: any) {
    console.error('❌ POST Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}