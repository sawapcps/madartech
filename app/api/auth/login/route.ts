import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { email, password } = await req.json();
        
        console.log('🔍 محاولة تسجيل الدخول:', email);

        // ✅ بيانات ثابتة للتجربة
        if (email === 'sawapcps@gmail.com' && password === '123456') {
            // ✅ إنشاء توكن بسيط
            const token = 'test_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);
            
            console.log('✅ تم إنشاء التوكن:', token);
            
            const response = NextResponse.json({
                success: true,
                data: {
                    user: {
                        id: 'user_001',
                        email: 'sawapcps@gmail.com',
                        name: 'مدير النظام',
                        role: 'admin'
                    },
                    token: token
                }
            });

            // ✅ تعيين الكوكي
            response.cookies.set('platform_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 7 * 24 * 60 * 60,
                path: '/',
            });

            console.log('✅ تم تعيين الكوكي');
            return response;
        }

        console.log('❌ بيانات غير صحيحة');
        return NextResponse.json(
            { error: 'بيانات الدخول غير صحيحة' },
            { status: 401 }
        );

    } catch (err) {
        console.error('Login error:', err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : 'Unknown error' },
            { status: 500 }
        );
    }
}