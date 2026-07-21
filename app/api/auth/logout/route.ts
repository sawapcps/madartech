import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        console.log('🔍 /api/auth/logout - بدء تسجيل الخروج');
        
        const response = NextResponse.json({ 
            success: true,
            message: 'تم تسجيل الخروج بنجاح'
        });
        
        // ✅ حذف الكوكي
        response.cookies.delete('platform_token');
        
        console.log('✅ تم حذف الكوكي');
        
        return response;
        
    } catch (err) {
        console.error('❌ خطأ في تسجيل الخروج:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}