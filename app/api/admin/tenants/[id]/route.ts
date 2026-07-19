import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbQuerySingle } from '@/lib/db/driver';
import { listTenantTables, queryTenantData, countTenantData, getTenantSchemaName } from '@/lib/tenant/manager';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; table?: string }> }
) {
  try {
    const { id, table } = await params;

    const tenant = await dbQuerySingle<{ id: string; schema_name: string; name: string }>(
      'SELECT id, schema_name, name FROM tenants WHERE id = $1',
      [id]
    );

    if (!tenant) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: CORS });
    }

    const schemaName = tenant.schema_name || getTenantSchemaName(id);
    const { searchParams } = new URL(req.url);
    const tableName = table || searchParams.get('table');

    if (!tableName) {
      // List tables
      const tables = await listTenantTables(schemaName);
      return NextResponse.json({ success: true, data: { tables, tenant: tenant.name } }, { headers: CORS });
    }

    // Get data from a specific table
    const limit = parseInt(searchParams.get('limit') || '100');
    const data = await queryTenantData(schemaName, tableName, { limit });
    const total = await countTenantData(schemaName, tableName);

    return NextResponse.json({
      success: true,
      data,
      meta: { table: tableName, tenant: tenant.name, total, limit },
    }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}