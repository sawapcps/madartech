import { NextResponse } from "next/server";
import { dbQuery } from "@/lib/db/driver";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET() {
  try {
    const tenantStats = await dbQuery(`
      SELECT 
        t.id,
        t.name as tenant_name,
        t.company,
        t.storage_limit_mb,
        t.db_limit_mb,
        t.status,
        COUNT(DISTINCT s.id) as file_count,
        COALESCE(SUM(s.size_bytes), 0) as total_storage_bytes,
        MAX(s.created_at) as last_upload
      FROM tenants t
      LEFT JOIN tenant_a0000000_0000_0000_0000_000000000001.storage s ON s.company_id = t.id
      GROUP BY t.id, t.name, t.company, t.storage_limit_mb, t.db_limit_mb, t.status
      ORDER BY total_storage_bytes DESC
    `);

    const latestResult = await dbQuery(`
      SELECT * FROM system_metrics 
      ORDER BY recorded_at DESC 
      LIMIT 1
    `);

    const latest = latestResult.length > 0 ? latestResult[0] : null;

    return NextResponse.json({
      success: true,
      data: {
        tenants: tenantStats,
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