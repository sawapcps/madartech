import { NextRequest, NextResponse } from "next/server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: CORS });
}

export async function GET(req: NextRequest) {
  try {
    // ✅ قراءة التوكن من cookies
    const token = req.cookies.get("platform_token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401, headers: CORS }
      );
    }

    // ✅ فك تشفير التوكن (base64)
    let payload;
    try {
      payload = JSON.parse(atob(token));
    } catch {
      return NextResponse.json(
        { error: "Invalid token" },
        { status: 401, headers: CORS }
      );
    }

    // ✅ التحقق من انتهاء الصلاحية
    if (payload.exp && Date.now() > payload.exp) {
      return NextResponse.json(
        { error: "Token expired" },
        { status: 401, headers: CORS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          user: {
            id: payload.uid,
            email: payload.email,
            name: payload.name,
            role: payload.role,
          },
        },
      },
      { headers: CORS }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500, headers: CORS }
    );
  }
}
