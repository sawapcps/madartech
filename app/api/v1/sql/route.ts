import { NextRequest, NextResponse } from "next/server";
import { dbQuery } from "@/lib/db/driver";

export async function POST(request: NextRequest) {
  try {
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
    
    if (params && (await params).length > 0) {
      result = await dbQuery(sql, params);
    } else {
      result = await dbQuery(sql);
    }
    
    const executionTime = Date.now() - startTime;

    let columns: string[] = [];
    if (result && result.length > 0) {
      columns = Object.keys(result[0]);
    }

    return NextResponse.json({
      success: true,
      data: result,
      rowCount: result?.length || 0,
      executionTime: executionTime + "ms",
      columns: columns
    });

  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint
    }, { status: 500 });
  }
}