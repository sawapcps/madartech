import { NextRequest, NextResponse } from 'next/server';
import { dbInsert } from '@/lib/db/driver';
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
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const tenantId = formData.get('tenant_id') as string;
    const note = formData.get('note') as string || 'تم الرفع من ملف خارجي';

    if (!file || !tenantId) {
      return NextResponse.json(
        { error: 'الملف و tenant_id مطلوبان' },
        { status: 400, headers: CORS }
      );
    }

    // التحقق من نوع الملف
    if (!file.name.endsWith('.json')) {
      return NextResponse.json(
        { error: 'يجب أن يكون الملف بصيغة JSON' },
        { status: 400, headers: CORS }
      );
    }

    // التأكد من وجود المجلد
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    // قراءة محتوى الملف والتحقق من صحة JSON
    const buffer = Buffer.from(await file.arrayBuffer());
    let jsonData: any;
    try {
      jsonData = JSON.parse(buffer.toString('utf-8'));
    } catch {
      return NextResponse.json(
        { error: 'الملف ليس بصيغة JSON صالحة' },
        { status: 400, headers: CORS }
      );
    }

    // التحقق من وجود tenant_id داخله (اختياري)
    const tenantIdFromFile = jsonData.tenant_id || jsonData.client_id;
    if (!tenantIdFromFile) {
      // لا نمنع الرفع، لكن ننبّه
      console.warn('⚠️ الملف لا يحتوي على tenant_id واضح');
    }

    // حفظ الملف في مجلد النسخ الاحتياطي
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `uploaded_${tenantId}_${timestamp}.json`;
    const filePath = path.join(BACKUP_DIR, filename);
    await fs.writeFile(filePath, buffer);

    const fileSize = (await fs.stat(filePath)).size;

    // تسجيل النسخة في قاعدة البيانات بحالة "uploaded"
    // أولاً نتحقق من هيكل الجدول لمعرفة الأعمدة المتاحة
    const columnsInfo = await dbQuery<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'backups'`
    );
    const hasTenantId = columnsInfo.some(c => c.column_name === 'tenant_id');
    const hasClientId = columnsInfo.some(c => c.column_name === 'client_id');
    const hasNote = columnsInfo.some(c => c.column_name === 'note');
    const hasStatus = columnsInfo.some(c => c.column_name === 'status');

    const insertObj: any = {
      id: randomUUID(),
      filename,
      size_bytes: fileSize,
      type: 'upload',
      schedule: 'none',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (hasTenantId) insertObj.tenant_id = tenantId;
    if (hasClientId) insertObj.client_id = tenantId;
    if (hasNote) insertObj.note = note;
    if (hasStatus) insertObj.status = 'uploaded';

    // نضع started_at و completed_at إن وجدا
    if (columnsInfo.some(c => c.column_name === 'started_at')) {
      insertObj.started_at = new Date().toISOString();
    }
    if (columnsInfo.some(c => c.column_name === 'completed_at')) {
      insertObj.completed_at = new Date().toISOString();
    }

    const backup = await dbInsert('backups', insertObj);

    return NextResponse.json({
      success: true,
      data: backup,
      message: 'تم رفع الملف بنجاح، يمكنك الآن استعادته باستخدام زر الاستعادة',
    }, { status: 201, headers: CORS });

  } catch (err) {
    console.error('❌ Upload Error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: CORS }
    );
  }
}