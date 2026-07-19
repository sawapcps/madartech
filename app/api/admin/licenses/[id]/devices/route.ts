import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const devices = await dbQuery(
      'SELECT * FROM devices WHERE license_id = $1',
      [id]
    );
    return NextResponse.json({ success: true, data: devices });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const device = await dbQuery(
      'INSERT INTO devices (license_id, name, status) VALUES ($1, $2, $3) RETURNING *',
      [id, body.name, body.status || 'active']
    );
    return NextResponse.json({ success: true, data: device[0] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await dbQuery('DELETE FROM devices WHERE id = $1', [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}