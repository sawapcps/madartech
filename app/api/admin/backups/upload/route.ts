import { NextRequest, NextResponse } from 'next/server';
import { dbInsert, dbQuery } from '@/lib/db/driver';
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const BACKUP_DIR = path.join(process.cwd(), 'backups');

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
  let tenantId = '';
  let file: File | null = null;
  let buffer: Buffer | null = null;
  let filename = '';

  try {
    const formData = await req.formData();
    file = formData.get('file') as File | null;
    tenantId = formData.get('tenant_id') as string;
    const note = formData.get('note') as string || 'تم الرفع من ملف خارجي';

    if (!file || !tenantId) {
      return NextResponse.json(
        { error: 'الملف و tenant_id مطلوبان' },
        { status: 400, headers: CORS }
      );
    }

    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { error: 'يجب أن يكون الملف بصيغة JSON' },
        { status: 400, headers: CORS }
      );
    }

    await fs.mkdir(BACKUP_DIR, { recursive: true });

    buffer = Buffer.from(await file.arrayBuffer());
    try {
      JSON.parse(buffer.toString('utf-8'));
    } catch {
      return NextResponse.json(
        { error: 'الملف ليس بصيغة JSON صالحة' },
        { status: 400, headers: CORS }
      );
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    filename = `uploaded_${tenantId}_${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    await fs.writeFile(filePath, buffer);
    const fileSize = (await fs.stat(filePath)).size;

    // ✅ جلب أعمدة جدول backups والقيم المسموحة لـ status
    const columns = await dbQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'backups'`
    );
    const columnNames = columns.map(c => c.column_name);

    // ✅ بناء كائن الإدراج
    const insertObj: any = {};

    // الأعمدة الأساسية
    const baseColumns = {
      id: randomUUID(),
      filename: filename,
      size_bytes: fileSize,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // ✅ الأعمدة الاختيارية (استخدام قيم مسموحة)
    const optionalColumns: Record<string, any> = {
      type: 'manual',        // ✅ manual, auto
      status: 'completed',  // ✅ pending, completed, failed, running
      schedule: 'none',     // ✅ none, daily, weekly, monthly
      note: note,
      tenant_id: tenantId,
      client_id: tenantId,
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    };

    // إضافة الأعمدة الأساسية
    for (const [col, val] of Object.entries(baseColumns)) {
      if (columnNames.includes(col)) {
        insertObj[col] = val;
      }
    }

    // إضافة الأعمدة الاختيارية (بقيم مسموحة)
    for (const [col, val] of Object.entries(optionalColumns)) {
      if (columnNames.includes(col)) {
        insertObj[col] = val;
      }
    }

    // ✅ إدراج السجل
    const backup = await dbInsert('backups', insertObj);

    return NextResponse.json({
      success: true,
      data: backup,
      message: 'تم رفع الملف بنجاح، يمكنك الآن استعادته باستخدام زر الاستعادة',
    }, { status: 201, headers: CORS });

  } catch (err: any) {
    console.error('❌ Upload Error:', err);

    // ✅ محاولة الإنقاذ بأقل عدد من الأعمدة
    try {
      if (buffer && tenantId) {
        const fallbackFilename = filename || `uploaded_${tenantId}_${Date.now()}.json`;
        const filePath = path.join(BACKUP_DIR, fallbackFilename);
        await fs.writeFile(filePath, buffer);
        const fileSize = (await fs.stat(filePath)).size;

        // ✅ أقل عدد من الأعمدة مع قيم صحيحة
        const minimalObj: any = {
          id: randomUUID(),
          filename: fallbackFilename,
          size_bytes: fileSize,
          created_at: new Date().toISOString(),
        };

        // جلب الأعمدة مرة أخرى
        const columns = await dbQuery<{ column_name: string }>(
          `SELECT column_name FROM information_schema.columns WHERE table_name = 'backups'`
        );
        const colNames = columns.map(c => c.column_name);

        // ✅ نضيف فقط الأعمدة الموجودة بقيم صحيحة
        const extraCols = ['updated_at', 'type', 'status', 'schedule', 'note', 'tenant_id', 'client_id'];
        for (const col of extraCols) {
          if (colNames.includes(col)) {
            if (col === 'updated_at') minimalObj[col] = new Date().toISOString();
            else if (col === 'type') minimalObj[col] = 'manual';
            else if (col === 'status') minimalObj[col] = 'completed'; // ✅ قيمة مسموحة
            else if (col === 'schedule') minimalObj[col] = 'none';
            else if (col === 'note') minimalObj[col] = 'تم الرفع من ملف خارجي';
            else if (col === 'tenant_id' || col === 'client_id') minimalObj[col] = tenantId;
          }
        }

        const backup = await dbInsert('backups', minimalObj);
        return NextResponse.json({
          success: true,
          data: backup,
          message: 'تم رفع الملف بنجاح',
        }, { status: 201, headers: CORS });
      }
    } catch (fallbackErr) {
      console.error('❌ Fallback insert failed:', fallbackErr);
    }

    return NextResponse.json(
      {
        error: err.message || 'حدث خطأ أثناء رفع الملف',
        detail: err.detail || err.code || undefined,
      },
      { status: 500, headers: CORS }
    );
  }
}