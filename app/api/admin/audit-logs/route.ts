/*
 * Admin API - Audit Logs
 * GET /api/admin/audit-logs - list audit logs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

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
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        const { searchParams } = new URL(req.url);
        const limit = parseInt(searchParams.get('limit') || '100');
        const action = searchParams.get('action');
        const tenantId = searchParams.get('tenant_id');

        let sql = `
            SELECT 
                al.*,
                u.name as user_name,
                u.email as user_email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
        `;
        const params: any[] = [];
        const conditions: string[] = [];

        if (action) {
            conditions.push('al.action LIKE ?');
            params.push(`${action}%`);
        }

        if (tenantId) {
            conditions.push('al.tenant_id = ?');
            params.push(tenantId);
        }

        if (conditions.length > 0) {
            sql += ' WHERE ' + conditions.join(' AND ');
        }

        sql += ' ORDER BY al.created_at DESC LIMIT ?';
        params.push(limit);

        const result = await db
            .prepare(sql)
            .bind(...params)
            .all();

        return NextResponse.json({
            success: true,
            data: result.results || []
        }, { headers: CORS });

    } catch (err) {
        console.error('❌ Logs Error:', err);
        return NextResponse.json({
            error: err instanceof Error ? err.message : 'Unknown error'
        }, { status: 500, headers: CORS });
    }
}