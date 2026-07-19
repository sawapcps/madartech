import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey } from '@/lib/auth/api-key';
import { dbQuery } from '@/lib/db/driver';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

const IMAGE_ROOT = path.join(process.cwd(), 'storage', 'images');

export async function POST(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const ctx = await resolveApiKey(apiKey);
    if (!ctx) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('image') as File;
    const category = (formData.get('category') as string) || 'general';
    const tableName = (formData.get('table_name') as string) || null;
    const recordId = (formData.get('record_id') as string) || null;

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Only images are allowed (JPEG, PNG, GIF, WEBP, SVG)' 
      }, { status: 400 });
    }

    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const fileName = `${timestamp}_${safeName}`;

    const schema = ctx.schemaName;
    const folderPath = path.join(IMAGE_ROOT, schema, category);
    await mkdir(folderPath, { recursive: true });

    const filePath = path.join(folderPath, fileName);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    const imageUrl = `/api/v1/images/${schema}/${category}/${fileName}`;
    const fullUrl = `${process.env.PLATFORM_URL || 'http://localhost:3000'}${imageUrl}`;

    const query = `
      INSERT INTO ${schema}.storage (file_name, file_path, file_size, file_type, folder, table_name, record_id, company_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    const result = await dbQuery(query, [
      file.name,
      imageUrl,
      file.size,
      file.type,
      category,
      tableName,
      recordId,
      ctx.tenantId
    ]);

    return NextResponse.json({
      success: true,
      data: {
        id: result[0].id,
        url: fullUrl,
        path: imageUrl,
        fileName: file.name,
        size: file.size,
        category: category,
        createdAt: result[0].created_at
      }
    }, { status: 201 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}