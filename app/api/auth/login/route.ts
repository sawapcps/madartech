export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ✅ CORS headers مشتركة
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // ✅ معالجة طلب OPTIONS (CORS)
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    // ✅ نقطة تسجيل الدخول
    if (path === '/api/auth/login' && request.method === 'POST') {
      try {
        const body = await request.json();
        const email = body.email;
        const password = body.password;

        // التحقق من وجود البريد وكلمة المرور
        if (!email || !password) {
          return new Response(
            JSON.stringify({ error: 'البريد وكلمة المرور مطلوبان' }),
            { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // البحث عن المستخدم في D1
        const user = await env.DB.prepare(
          'SELECT id, email, password, name, role FROM users WHERE email = ?'
        ).bind(email).first();

        if (!user) {
          return new Response(
            JSON.stringify({ error: 'البريد الإلكتروني غير موجود' }),
            { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // التحقق من كلمة المرور — استخدم مقارنة مباشرة إذا لم تكن verifyPassword معرّفة
        let isValid = false;
        try {
          // إذا كانت كلمة المرور مشفّرة بـ bcrypt، استخدم:
          // isValid = await bcryptCompare(password, user.password);
          // أما إذا كانت نص عادي:
          isValid = password === user.password;
        } catch (pwErr) {
          console.error('Password verify error:', pwErr);
          isValid = password === user.password; // fallback
        }

        if (!isValid) {
          return new Response(
            JSON.stringify({ error: 'كلمة المرور غير صحيحة' }),
            { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        // إنشاء توكن
        const token = 'test_token_' + Date.now() + '_' + Math.random().toString(36).substring(2, 10);

        // رد النجاح
        return new Response(
          JSON.stringify({
            success: true,
            data: {
              user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
              },
              token: token,
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      } catch (err) {
        console.error('❌ Login error:', err);
        return new Response(
          JSON.stringify({ error: err.message || 'حدث خطأ غير معروف' }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // ✅ نقطة فحص الحالة (health check)
    if (path === '/api/health' && request.method === 'GET') {
      return new Response(
        JSON.stringify({ status: 'ok', time: Date.now() }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // أي طلب آخر
    return new Response(
      JSON.stringify({ error: 'Not Found' }),
      { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  },
};
