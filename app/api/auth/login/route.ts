import { getCloudflareContext } from "@opennextjs/cloudflare";

export async function POST(request: Request) {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    console.log("🔍 Login attempt started");
    const body = await request.json();
    const email = body.email;
    const password = body.password;

    console.log("📧 Email:", email);

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "البريد وكلمة المرور مطلوبان" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ✅ الوصول إلى D1 عبر getCloudflareContext
    const { env } = await getCloudflareContext();
    console.log("🔍 Context received: Yes");

    const user = await env.DB.prepare(
      "SELECT id, email, password, name, role FROM users WHERE email = ?"
    )
      .bind(email)
      .first();

    console.log("👤 User found:", user ? "Yes" : "No");

    if (!user) {
      return new Response(
        JSON.stringify({ error: "البريد الإلكتروني غير موجود" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ✅ التحقق من كلمة المرور — يدعم salt:hash ونص عادي
    let isValid = false;
    try {
      if (user.password.includes(":")) {
        // صيغة salt:hash (SHA-256)
        const [salt, storedHash] = user.password.split(":");
        const encoder = new TextEncoder();
        const data = encoder.encode(salt + password);
        const hashBuffer = await crypto.subtle.digest("SHA-256", data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const computedHash = hashArray
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        isValid = computedHash === storedHash;
        console.log("🔐 Password check (salt:hash):", isValid);
      } else {
        isValid = password === user.password;
        console.log("🔐 Password check (plain):", isValid);
      }
    } catch (pwErr) {
      console.error("❌ Password verify error:", pwErr);
      isValid = false;
    }

    if (!isValid) {
      return new Response(
        JSON.stringify({ error: "كلمة المرور غير صحيحة" }),
        { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // ✅ إنشاء توكن
    const token = btoa(
      JSON.stringify({
        uid: user.id,
        email: user.email,
        role: user.role,
        exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
      })
    );

    console.log("✅ Login successful for:", email);

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
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (err) {
    console.error("❌ Login error:", err.message, err.stack);
    return new Response(
      JSON.stringify({ error: err.message || "حدث خطأ غير معروف" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
}

// ✅ معالجة CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
