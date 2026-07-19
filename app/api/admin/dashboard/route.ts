/*
 * Admin API — Dashboard Stats
 * GET /api/admin/dashboard — aggregated stats for the dashboard overview
 */

import { NextResponse } from 'next/server';
import { dbQuery, dbQuerySingle } from '@/lib/db/driver';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET() {
  try {
    const [tenants, apps, licenses, logs] = await Promise.all([
      dbQuery<{ status: string }>('SELECT status FROM tenants'),
      dbQuery<{ status: string }>('SELECT status FROM applications'),
      dbQuery<{ status: string }>('SELECT status FROM licenses'),
      dbQuery('SELECT action, entity_type, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 10'),
    ]);

    const activeTenants = tenants.filter(t => t.status === 'active').length;
    const activeLicenses = licenses.filter(l => l.status === 'active').length;

    return NextResponse.json({
      success: true,
      data: {
        totalTenants: tenants.length,
        activeTenants,
        suspendedTenants: tenants.filter(t => t.status === 'suspended').length,
        totalApplications: apps.length,
        activeApplications: apps.filter(a => a.status === 'active').length,
        totalLicenses: licenses.length,
        activeLicenses,
        recentLogs: logs,
      },
    }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}
