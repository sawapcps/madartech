import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db/driver';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(req: NextRequest) {
    try {
        const env = (req as any).env || process.env;
        const db = await getDb(env);
        
        let { sql, params } = await req.json();

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

        // ✅ حوّل الروابط النسبية إلى كاملة في image_url
        if (params && Array.isArray(params)) {
            params = params.map(p => {
                if (typeof p === 'string' && p.startsWith('/api/v1/storage')) {
                    return `https://cloud.madartech.uk${p}`;
                }
                return p;
            });
        }

        // ✅ منع undefined من مسح image_url في UPDATE products
        if (sql.toUpperCase().includes('UPDATE PRODUCTS') && params) {
            const sqlLower = sql.toLowerCase();
            const imageMatch = sqlLower.match(/image_url\s*=\s*\?/);
            if (imageMatch) {
                const setPart = sql.substring(sql.toLowerCase().indexOf('set ') + 4, sql.toLowerCase().indexOf(' where'));
                const columns = setPart.split(',').map(c => {
                    const m = c.trim().match(/^(\w+)\s*=\s*\?/);
                    return m ? m[1] : null;
                });
                const imageIndex = columns.findIndex(c => c === 'image_url');
                
                if (imageIndex >= 0 && (params[imageIndex] === undefined || params[imageIndex] === null)) {
                    const productId = params[columns.length];
                    
                    const existing = await db
                        .prepare('SELECT image_url FROM products WHERE id = ?')
                        .bind(productId)
                        .all();
                    
                    if (existing.results && existing.results.length > 0) {
                        params[imageIndex] = (existing.results[0] as any).image_url || null;
                    }
                }
            }
        }

        const startTime = Date.now();
        const result = await db.prepare(sql).bind(...(params || [])).all();
        const executionTime = Date.now() - startTime;

        const data = result.results || [];

        let columns: string[] = [];
        if (data.length > 0) {
            columns = Object.keys(data[0]);
        }

        return NextResponse.json({
            success: true,
            data: data,
            columns: columns,
            count: data.length,
            executionTime: executionTime
        }, { headers: CORS });

    } catch (error: any) {
        console.error('❌ SQL Error:', error);
        return NextResponse.json({
            success: false,
            error: error.message || 'فشل تنفيذ الاستعلام'
        }, { 
            status: 500, 
            headers: CORS 
        });
    }
}
