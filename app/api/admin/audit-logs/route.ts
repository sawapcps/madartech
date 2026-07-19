/*
 * Admin API - Audit Logs
 * GET /api/admin/audit-logs - list audit logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db/driver';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const action = searchParams.get('action');

    let sql = 'SELECT * FROM audit_logs';
    const params: string[] = [];
    
    if (action) {
      sql += ' WHERE action LIKE $1';
      params.push(`${action}%`);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1);
    params.push(String(limit));

    const logs = await dbQuery(sql, params);
    return NextResponse.json({ success: true, data: logs }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}