import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

// ✅ CORS Headers
const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

// ✅ دالة OPTIONS (مهمة لـ CORS - يتم استدعاؤها قبل POST)
export async function OPTIONS() {
    return new NextResponse(null, { 
        status: 204, 
        headers: CORS 
    });
}

export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        
        const { sql, params } = await req.json();

        console.log('📝 SQL:', sql);
        console.log('📊 Params:', params);

        if (!sql) {
            return NextResponse.json({ 
                success: false, 
                error: 'SQL query is required' 
            }, { 
                status: 400, 
                headers: CORS 
            });
        }

        // ✅ تنفيذ الاستعلام
        const startTime = Date.now();
        const result = await db.prepare(sql).bind(...(params || [])).all();
        const executionTime = Date.now() - startTime;

        // ✅ التحقق من النتيجة
        const data = result.results || [];
        
        // ✅ إرجاع النتيجة مع CORS
        return NextResponse.json({ 
            success: true, 
            data: data,
            rowCount: data.length,
            executionTime: `${executionTime}ms`
        }, { 
            headers: CORS 
        });

    } catch (error: any) {
        console.error('❌ SQL Error:', error);
        
        return NextResponse.json({ 
            success: false, 
            error: error.message || 'Internal server error'
        }, { 
            status: 500, 
            headers: CORS 
        });
    }
}
