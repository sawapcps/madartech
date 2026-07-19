import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';

// GET /api/admin/api-keys - List all API keys
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get specific API key
      const keys = await dbQuery(
        'SELECT * FROM api_keys WHERE id = $1',
        [id]
      );
      
      if (!keys || keys.length === 0) {
        return NextResponse.json({ error: 'API key not found' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true, data: keys[0] });
    }

    // List all API keys
    const keys = await dbQuery('SELECT * FROM api_keys ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data: keys });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/api-keys - Create new API key
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const body = await req.json();
    const { name, permissions } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    // Generate API key
    const apiKey = `ak_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const result = await dbQuery(
      `INSERT INTO api_keys (name, key, permissions, created_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [name, apiKey, permissions || '{}']
    );

    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/api-keys - Update API key
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const body = await req.json();

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      );
    }

    const { name, permissions, is_active } = body;
    
    const result = await dbQuery(
      `UPDATE api_keys 
       SET name = COALESCE($1, name),
           permissions = COALESCE($2, permissions),
           is_active = COALESCE($3, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, permissions, is_active, id]
    );

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/api-keys - Delete API key
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400 }
      );
    }

    const result = await dbQuery(
      'DELETE FROM api_keys WHERE id = $1 RETURNING *',
      [id]
    );

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}