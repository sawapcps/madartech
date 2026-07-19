import { NextRequest, NextResponse } from 'next/server';
import { dbQuery, dbInsert, dbUpdate, dbDelete } from '@/lib/db/driver';
import path from 'path';
import fs from 'fs';
import fsPromises from 'fs/promises';
import { randomUUID } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BACKUP_DIR = path.join(process.cwd(), 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

// ============================================================
// POST - إنشاء نسخة احتياطية جديدة
// ============================================================
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tenant_id, client_id, schedule, note } = body;

    // التحقق من وجود معرف
    const idValue = tenant_id || client_id;
    if (!idValue) {
      return NextResponse.json({ error: 'tenant_id or client_id is required' }, { status: 400, headers: CORS });
    }

    // ============================================================
    // التأكد من وجود العميل في جدول clients
    // ============================================================
    // 1. التحقق مما إذا كان المعرف موجوداً في clients
    const existingClient = await dbQuery(`SELECT id FROM clients WHERE id = $1`, [idValue]);

    if (existingClient.length === 0) {
      // 2. إذا لم يكن موجوداً، نبحث عنه في جدول tenants
      const tenant = await dbQuery(`SELECT name, email FROM tenants WHERE id = $1`, [idValue]);

      if (tenant.length > 0) {
        // إنشاء عميل في clients من بيانات tenant
        await dbInsert('clients', {
          id: idValue,
          name: tenant[0].name,
          email: tenant[0].email,
          status: 'active',
        });
        console.log(`✅ تم إنشاء عميل ${idValue} في جدول clients من tenants`);
      } else {
        // إذا لم يكن موجوداً في tenants أيضاً ننشئ عميل افتراضي
        await dbInsert('clients', {
          id: idValue,
          name: 'Unknown Client',
          email: `client_${idValue}@example.com`,
          status: 'active',
        });
        console.log(`⚠️ تم إنشاء عميل افتراضي ${idValue} في جدول clients`);
      }
    } else {
      console.log(`✅ العميل ${idValue} موجود مسبقاً في جدول clients`);
    }

    // ============================================================
    // جمع بيانات النسخ الاحتياطي من جميع الجداول
    // ============================================================

    // قائمة الجداول (يمكنك تعديلها حسب احتياجك)
    const tables = ['products', 'customers', 'sales', 'suppliers', 'purchases', 'expenses', 'cheques', 'areas', 'users', 'companies'];
    const backupData: any = {
      tenant_id: idValue,
      exported_at: new Date().toISOString(),
      version: '1.0',
      tables: {}
    };

    for (const table of tables) {
      try {
        const rows = await dbQuery(`SELECT * FROM ${table} WHERE company_id = $1 OR tenant_id = $1`, [idValue]);
        backupData.tables[table] = rows || [];
      } catch {
        backupData.tables[table] = [];
      }
    }

    // حفظ الملف
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_${idValue}_${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    await fsPromises.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
    const fileSize = (await fsPromises.stat(filePath)).size;

    // الحصول على معلومات أعمدة جدول backups
    const columnsInfo = await dbQuery<{
      column_name: string;
      is_nullable: string;
      data_type: string;
      column_default: string | null;
    }>(
      `SELECT column_name, is_nullable, data_type, column_default
       FROM information_schema.columns 
       WHERE table_name = 'backups'
       ORDER BY ordinal_position`
    );

    // بناء كائن الإدراج
    const insertObj: any = {};

    for (const col of columnsInfo) {
      const colName = col.column_name;
      let value: any = null;
      const hasDefault = col.column_default !== null;

      switch (colName) {
        case 'id':
          if (!hasDefault) {
            if (col.data_type === 'uuid') {
              value = randomUUID();
            } else {
              value = undefined;
            }
          } else {
            value = undefined;
          }
          break;
        case 'tenant_id':
          value = tenant_id || client_id;
          break;
        case 'client_id':
          value = client_id || tenant_id;
          break;
        case 'type':
          value = body.type || 'manual';
          break;
        case 'status':
          value = 'completed';
          break;
        case 'schedule':
          value = schedule || 'none';
          break;
        case 'size_bytes':
          value = fileSize;
          break;
        case 'filename':
          value = filename;
          break;
        case 'note':
          value = note || null;
          break;
        case 'started_at':
        case 'completed_at':
        case 'created_at':
        case 'updated_at':
          value = new Date().toISOString();
          break;
        case 'restored_at':
        case 'restored_by':
          value = null;
          break;
        default:
          value = null;
      }

      if (value !== undefined) {
        insertObj[colName] = value;
      }
    }

    // إدراج السجل
    const backup = await dbInsert('backups', insertObj);
    if (!backup) {
      throw new Error('Failed to insert backup record');
    }

    return NextResponse.json({
      success: true,
      data: backup,
      download_url: `/api/admin/backups?id=${(backup as any).id}&download=true`
    }, { status: 201, headers: CORS });

  } catch (err) {
    console.error('❌ POST Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

// ============================================================
// GET - استرجاع النسخ الاحتياطية
// ============================================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get('tenant_id');
    const clientId = searchParams.get('client_id');
    const id = searchParams.get('id');
    const download = searchParams.get('download');

    if (id && download === 'true') {
      const backups = await dbQuery(`SELECT * FROM backups WHERE id = $1`, [id]);
      if (!backups || backups.length === 0) {
        return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
      }

      const backup = backups[0] as any;
      const filePath = path.join(BACKUP_DIR, backup.filename);
      try {
        const fileContent = await fsPromises.readFile(filePath);
        return new NextResponse(fileContent, {
          status: 200,
          headers: {
            ...CORS,
            'Content-Type': 'application/json',
            'Content-Disposition': `attachment; filename="${backup.filename}"`,
          },
        });
      } catch {
        return NextResponse.json({ error: 'Backup file not found' }, { status: 404, headers: CORS });
      }
    }

    let sql = `
      SELECT b.*, t.name as tenant_name 
      FROM backups b 
      LEFT JOIN tenants t ON b.tenant_id = t.id
    `;
    const queryParams: string[] = [];
    const conditions: string[] = [];

    if (tenantId) {
      conditions.push(`b.tenant_id = $${queryParams.length + 1}`);
      queryParams.push(tenantId);
    }
    if (clientId) {
      conditions.push(`b.client_id = $${queryParams.length + 1}`);
      queryParams.push(clientId);
    }

    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' OR ')}`;
    }
    sql += ` ORDER BY b.created_at DESC`;

    const backups = await dbQuery(sql, queryParams);
    return NextResponse.json({ success: true, data: backups }, { headers: CORS });
  } catch (err) {
    console.error('❌ GET Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

// ============================================================
// PUT - استعادة نسخة احتياطية
// ============================================================
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS });
    }

    const backups = await dbQuery(`SELECT * FROM backups WHERE id = $1`, [id]);
    if (!backups || backups.length === 0) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
    }

    const backup = backups[0] as any;
    const filePath = path.join(BACKUP_DIR, backup.filename);

    let fileContent: string;
    try {
      fileContent = await fsPromises.readFile(filePath, 'utf-8');
    } catch {
      return NextResponse.json({ error: 'Backup file not found' }, { status: 404, headers: CORS });
    }

    const backupData = JSON.parse(fileContent);
    const tenantId = backupData.tenant_id || backupData.client_id;
    if (!tenantId) {
      return NextResponse.json({ error: 'Invalid backup: missing tenant/client ID' }, { status: 400, headers: CORS });
    }

    const tables = Object.keys(backupData.tables || {});
    let restoredCount = 0;

    await dbQuery('BEGIN');

    try {
      for (const table of tables) {
        const rows = backupData.tables[table];
        if (!rows || rows.length === 0) continue;

        await dbQuery(`DELETE FROM ${table} WHERE company_id = $1 OR tenant_id = $1`, [tenantId]);

        for (const row of rows) {
          try {
            await dbInsert(table, row);
            restoredCount++;
          } catch (e) {
            console.warn(`⚠️ Failed to restore row in ${table}:`, e);
          }
        }
      }

      await dbUpdate('backups', {
        restored_at: new Date().toISOString(),
        restored_by: 'admin',
        status: 'restored',
      }, { id });

      await dbQuery('COMMIT');

      return NextResponse.json({
        success: true,
        message: `✅ تم استعادة ${restoredCount} صف من ${tables.length} جداول`,
        data: {
          tenant_id: tenantId,
          tables_restored: tables,
          rows_restored: restoredCount
        }
      }, { headers: CORS });

    } catch (err) {
      await dbQuery('ROLLBACK');
      throw err;
    }

  } catch (err) {
    console.error('❌ PUT Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}

// ============================================================
// DELETE - حذف نسخة احتياطية
// ============================================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400, headers: CORS });
    }

    const backups = await dbQuery(`SELECT * FROM backups WHERE id = $1`, [id]);
    if (!backups || backups.length === 0) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404, headers: CORS });
    }

    const backup = backups[0] as any;

    if (backup.filename) {
      const filePath = path.join(BACKUP_DIR, backup.filename);
      try {
        await fsPromises.unlink(filePath);
      } catch {
        // تجاهل
      }
    }

    await dbDelete('backups', { id });

    return NextResponse.json({ success: true, message: '✅ تم حذف النسخة الاحتياطية' }, { headers: CORS });

  } catch (err) {
    console.error('❌ DELETE Error:', err);
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Unknown error' }, { status: 500, headers: CORS });
  }
}