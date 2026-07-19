/*
 * Admin API - Tenant Management
 * GET    /api/admin/tenants - list all tenants
 * POST   /api/admin/tenants - create new tenant (creates schema automatically)
 * DELETE /api/admin/tenants?id=... - delete tenant (drops schema first, then row)
 * PUT    /api/admin/tenants?id=... - update tenant fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbInsert, dbUpdate, dbDelete, dbQuerySingle } from '@/lib/db/driver';
import { createTenantSchema, initAppTables, dropTenantSchema, Tenant } from '@/lib/tenant/manager';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (id) {
      // Get single tenant
      const tenant = await dbQuerySingle<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);
      if (!tenant) {
        return NextResponse.json({ error: 'Tenant not found' }, { status: 404, headers: CORS });
      }
      return NextResponse.json({ success: true, data: tenant }, { headers: CORS });
    }

    // List all tenants
    const tenants = await dbQuery<Tenant>('SELECT * FROM tenants ORDER BY created_at DESC');
    return NextResponse.json({ success: true, data: tenants }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const body = await req.json();
    const { name, email, phone, company, storage_limit_mb, db_limit_mb, notes } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: 'Name and email are required' },
        { status: 400, headers: CORS }
      );
    }

    // Insert tenant with a temporary schema name (will be updated after schema creation)
    const tenant = await dbInsert<Tenant>('tenants', {
      name,
      email,
      phone: phone || null,
      company: company || null,
      storage_limit_mb: storage_limit_mb || 5120,
      db_limit_mb: db_limit_mb || 1024,
      notes: notes || null,
      status: 'active',
      schema_name: 'pending',
    });

    if (!tenant) {
      return NextResponse.json(
        { error: 'Failed to create tenant' },
        { status: 500, headers: CORS }
      );
    }

    // Create the isolated schema
    const schemaName = await createTenantSchema(tenant.id);

    return NextResponse.json({
      success: true,
      data: { ...tenant, schema_name: schemaName },
      meta: { schema_created: true, schema_name: schemaName },
    }, { status: 201, headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}

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
        { status: 400, headers: CORS }
      );
    }

    // Drop the tenant's isolated schema first, then remove the row.
    await dropTenantSchema(id);
    const deleted = await dbDelete('tenants', { id });

    if (deleted === 0) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404, headers: CORS }
      );
    }

    return NextResponse.json({
      success: true,
      data: { id, deleted: true },
      meta: { schema_dropped: true }
    }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'id query parameter is required' },
        { status: 400, headers: CORS }
      );
    }

    const body = await req.json();
    const { name, email, phone, company, storage_limit_mb, db_limit_mb, notes, status } = body;

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (phone !== undefined) updates.phone = phone;
    if (company !== undefined) updates.company = company;
    if (storage_limit_mb !== undefined) updates.storage_limit_mb = storage_limit_mb;
    if (db_limit_mb !== undefined) updates.db_limit_mb = db_limit_mb;
    if (notes !== undefined) updates.notes = notes;
    if (status !== undefined) updates.status = status;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No fields provided to update' },
        { status: 400, headers: CORS }
      );
    }

    const updated = await dbUpdate<Tenant>('tenants', updates, { id });

    if (updated.length === 0) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404, headers: CORS }
      );
    }

    return NextResponse.json({ success: true, data: updated[0] }, { headers: CORS });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}