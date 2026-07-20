// lib/logger.ts
import { getDb } from './db/driver';

export async function logAction(
    action: string,
    userId: string,
    tenantId: string,
    details: any,
    ipAddress?: string
) {
    try {
        const env = (global as any).__env || process.env;
        const db = await getDb(env);

        await db
            .prepare(`
                INSERT INTO audit_logs (
                    user_id, tenant_id, action, details, 
                    ip_address, created_at
                ) VALUES (?, ?, ?, ?, ?, datetime('now'))
            `)
            .bind(
                userId,
                tenantId,
                action,
                JSON.stringify(details),
                ipAddress || '127.0.0.1'
            )
            .run();
    } catch (error) {
        console.error('Failed to log action:', error);
    }
}

// ✅ دوال مساعدة
export async function logLogin(userId: string, tenantId: string, ipAddress?: string) {
    await logAction('auth.login', userId, tenantId, { event: 'تسجيل الدخول' }, ipAddress);
}

export async function logLogout(userId: string, tenantId: string, ipAddress?: string) {
    await logAction('auth.logout', userId, tenantId, { event: 'تسجيل الخروج' }, ipAddress);
}

export async function logCreate(userId: string, tenantId: string, entity: string, data: any, ipAddress?: string) {
    await logAction(`create.${entity}`, userId, tenantId, { event: `إنشاء ${entity}`, data }, ipAddress);
}

export async function logUpdate(userId: string, tenantId: string, entity: string, data: any, ipAddress?: string) {
    await logAction(`update.${entity}`, userId, tenantId, { event: `تحديث ${entity}`, data }, ipAddress);
}

export async function logDelete(userId: string, tenantId: string, entity: string, id: string, ipAddress?: string) {
    await logAction(`delete.${entity}`, userId, tenantId, { event: `حذف ${entity}`, id }, ipAddress);
}