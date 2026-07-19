import { NextRequest, NextResponse } from 'next/server';
import { resolveApiKey } from '@/lib/auth/api-key';
import { dbQuery } from '@/lib/db/driver';

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('x-api-key');
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing API key' }, { status: 401 });
    }

    const ctx = await resolveApiKey(apiKey);
    if (!ctx) {
      return NextResponse.json({ error: 'Invalid API key' }, { status: 403 });
    }

    const schema = ctx.schemaName;

    // جلب جميع الجداول في Schema
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = $1 
        AND table_name NOT IN ('storage', 'activity_logs', 'settings')
      ORDER BY table_name
    `;
    
    const tables = await dbQuery(query, [schema]);
    const tableNames = tables.map(row => row.table_name);

    return NextResponse.json({ 
      success: true, 
      data: tableNames 
    });
  } catch (error: any) {
    console.error('Error fetching tables:', error);
    return NextResponse.json({ 
      error: error.message 
    }, { status: 500 });
  }
}