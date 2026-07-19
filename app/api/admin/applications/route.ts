import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';

// GET /api/admin/applications - List all applications
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get specific application
      const apps = await dbQuery(
        'SELECT * FROM applications WHERE id = $1',
        [id]
      );
      
      if (!apps || apps.length === 0) {
        return NextResponse.json({ error: 'Application not found' }, { status: 404 });
      }
      
      return NextResponse.json({ success: true, data: apps[0] });
    }

    // List all applications
    const apps = await dbQuery('SELECT * FROM applications ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data: apps });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST /api/admin/applications - Create new application
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const body = await req.json();
    const { name, description, status } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const result = await dbQuery(
      `INSERT INTO applications (name, description, status, created_at) 
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP) 
       RETURNING *`,
      [name, description || '', status || 'active']
    );

    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT /api/admin/applications - Update application
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

    const { name, description, status } = body;
    
    const result = await dbQuery(
      `UPDATE applications 
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           status = COALESCE($3, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, description, status, id]
    );

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/applications - Delete application
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
      'DELETE FROM applications WHERE id = $1 RETURNING *',
      [id]
    );

    if (!result || result.length === 0) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: result[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}