import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/driver";

export async function POST(request: NextRequest) {
    try {
        const env = (request as any).env || process.env;
        const db = await getDb(env);

        const { sql, params } = await request.json();

        if (!sql || sql.trim() === "") {
            return NextResponse.json({
                success: false,
                error: "الاستعلام مطلوب"
            }, { status: 400 });
        }

        // ✅ ✅ ✅ تم إزالة جميع القيود - أنت المدير!
        // يمكنك تنفيذ أي استعلام تريده

        const startTime = Date.now();
        let result;
        
        if (params && params.length > 0) {
            const stmt = db.prepare(sql);
            result = await stmt.bind(...params).all();
        } else {
            result = await db.prepare(sql).all();
        }
        
        const executionTime = Date.now() - startTime;

        let columns: string[] = [];
        if (result.results && result.results.length > 0) {
            columns = Object.keys(result.results[0]);
        }

        return NextResponse.json({
            success: true,
            data: result.results || [],
            rowCount: result.results?.length || 0,
            executionTime: executionTime + "ms",
            columns: columns
        });

    } catch (error: any) {
        console.error("❌ SQL Error:", error);
        return NextResponse.json({
            success: false,
            error: error.message || "خطأ في تنفيذ الاستعلام",
            code: error.code,
            detail: error.detail,
            hint: error.hint
        }, { status: 500 });
    }
}