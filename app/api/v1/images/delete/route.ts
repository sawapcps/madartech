import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey } from '@/lib/auth/api-key';
import { dbQuery } from '@/lib/db/driver';
import { unlink } from 'fs/promises';
import path from 'path';

const IMAGE_ROOT = path.join(process.cwd(), 'storage', 'images');

export async function DELETE(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const ctx = await resolveApiKey(apiKey);
    if (!ctx) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get('id');

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 });
    }

    const schema = ctx.schemaName;

    const getQuery = `SELECT * FROM ${schema}.storage WHERE id = $1`;
    const imageData = await dbQuery(getQuery, [imageId]);

    if (!imageData || imageData.length === 0) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    const image = imageData[0];

    const filePath = path.join(IMAGE_ROOT, schema, image.folder, image.file_name);
    try {
      await unlink(filePath);
    } catch {
      // File may already be deleted
    }

    const deleteQuery = `DELETE FROM ${schema}.storage WHERE id = $1`;
    await dbQuery(deleteQuery, [imageId]);

    return NextResponse.json({
      success: true,
      message: 'Image deleted successfully'
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
