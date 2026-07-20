import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/driver";

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);

        // جلب إحصائيات العملاء
        const tenantStats = await db
            .prepare(`
                SELECT 
                    t.id,
                    t.name as tenant_name,
                    t.company,
                    t.storage_limit_mb,
                    t.db_limit_mb,
                    t.status,
                    COUNT(DISTINCT c.id) as customer_count,
                    COUNT(DISTINCT p.id) as product_count,
                    COUNT(DISTINCT s.id) as sale_count,
                    t.created_at
                FROM tenants t
                LEFT JOIN customers c ON c.tenant_id = t.id
                LEFT JOIN products p ON p.tenant_id = t.id
                LEFT JOIN sales s ON s.tenant_id = t.id
                GROUP BY t.id, t.name, t.company, t.storage_limit_mb, t.db_limit_mb, t.status, t.created_at
                ORDER BY t.created_at DESC
            `)
            .all();

        // جلب آخر المقاييس
        const latestResult = await db
            .prepare(`
                SELECT * FROM system_metrics 
                ORDER BY recorded_at DESC 
                LIMIT 1
            `)
            .all();

        const latest = latestResult.results?.length > 0 ? latestResult.results[0] : null;

        const totalTenants = tenantStats.results?.length || 0;
        const activeTenants = tenantStats.results?.filter((t: any) => t.status === 'active').length || 0;

        return NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalTenants: totalTenants,
                    totalFiles: 0,
                    totalStorage: 0,
                    activeTenants: activeTenants,
                },
                tenants: tenantStats.results || [],
                system: {
                    latest: latest ? {
                        cpu_usage: Number(latest.cpu_usage || 0),
                        ram_usage: Number(latest.ram_usage || 0),
                        storage_usage: Number(latest.storage_usage || 0),
                        active_connections: Number(latest.active_connections || 0),
                        requests_per_min: Number(latest.requests_per_min || 0),
                        error_count: Number(latest.error_count || 0),
                        db_query_avg_ms: Number(latest.db_query_avg_ms || 0),
                    } : null,
                },
            },
        }, { headers: CORS });

    } catch (err) {
        console.error("❌ Metrics Error:", err);
        return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : "Unknown error",
        }, { status: 500, headers: CORS });
    }
}