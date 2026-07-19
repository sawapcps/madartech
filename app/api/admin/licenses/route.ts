/*
 * Admin API � Licenses Management
 * GET    /api/admin/licenses � list all licenses
 * POST   /api/admin/licenses � create new license (and init app tables for tenant)
 * DELETE /api/admin/licenses?id=... � delete license
 * PUT    /api/admin/licenses?id=... � update license (e.g. status change)
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbInsert, dbUpdate, dbDelete, dbQuerySingle } from '@/lib/db/driver';
import { initAppTables } from '@/lib/tenant/manager';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

function generateLicenseKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const block = () => Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `MT-${block()}-${block()}-${block()}`;
}

export async function GET() {
  try {
    const licenses = await dbQuery(`
      SELECT l.*, t.name as tenant_name, a.name as application_name, a.slug as application_slug
      FROM licenses l
      JOIN tenants t ON l.tenant_id = t.id
      JOIN applications a ON l.application_id = a.id
      ORDER BY l.created_at DESC
    `);
    return NextResponse.json({ success: true, data: licenses }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, application_id, end_date, max_devices } = body;

    if (!tenant_id || !application_id || !end_date) {
      return NextResponse.json({ error: 'tenant_id, application_id, and end_date are required' }, { status: 400, headers: CORS });
    }

    const licenseKey = generateLicenseKey();

    const license = await dbInsert('licenses', {
      license_key: licenseKey,
      tenant_id,
      application_id,
      end_date,
      max_devices: max_devices || 1,
      status: 'active',
      start_date: new Date().toISOString().split('T')[0],
    });

    // Initialize app tables in the tenant schema
    const app = await dbQuerySingle<{ slug: string }>('SELECT slug FROM applications WHERE id = $1', [application_id]);
    if (app) {
      await initAppTables(tenant_id, app.slug);
    }

    return NextResponse.json({ success: true, data: license, meta: { license_key: licenseKey } }, { status: 201, headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400, headers: CORS });
    }

    const deleted = await dbDelete('licenses', { id });

    if (deleted === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404, headers: CORS });
    }

    return NextResponse.json({ success: true, data: { id, deleted: true } }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400, headers: CORS });
    }

    const body = await req.json();
    const { status, end_date, max_devices } = body;

    const updates: Record<string, unknown> = {};
    if (status !== undefined) updates.status = status;
    if (end_date !== undefined) updates.end_date = end_date;
    if (max_devices !== undefined) updates.max_devices = max_devices;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields provided to update' }, { status: 400, headers: CORS });
    }

    const updated = await dbUpdate('licenses', updates, { id });

    if (updated.length === 0) {
      return NextResponse.json({ error: 'License not found' }, { status: 404, headers: CORS });
    }

    return NextResponse.json({ success: true, data: updated[0] }, { headers: CORS });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}
