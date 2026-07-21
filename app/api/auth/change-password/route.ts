import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    // ✅ التحقق من التوكن
    const token = req.cookies.get('platform_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'غير موثق' },
        { status: 401 }
      );
    }

    // ✅ قراءة البيانات
    const { currentPassword, newPassword } = await req.json();

    // ✅ التحقق من البيانات
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'جميع الحقول مطلوبة' },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' },
        { status: 400 }
      );
    }

    // ✅ التحقق من كلمة المرور الحالية (ثابتة للتجربة)
    // في الإنتاج يجب التحقق من قاعدة البيانات
    if (currentPassword !== '123456') {
      return NextResponse.json(
        { error: 'كلمة المرور الحالية غير صحيحة' },
        { status: 400 }
      );
    }

    // ✅ هنا يمكن تحديث كلمة المرور في قاعدة البيانات
    // await dbUpdate('platform_users', { password_hash: hashPassword(newPassword) }, { id: user.id });

    return NextResponse.json({
      success: true,
      message: '✅ تم تغيير كلمة المرور بنجاح'
    });

  } catch (err) {
    console.error('❌ Change password error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'حدث خطأ غير معروف' },
      { status: 500 }
    );
  }
}
