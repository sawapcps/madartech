import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs/promises";

const STORAGE_DIR = path.join(process.cwd(), "storage", "uploads");

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    console.log("📂 File requested:", filename);
    console.log("📁 Directory:", STORAGE_DIR);

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    const filePath = path.join(STORAGE_DIR, filename);
    console.log("📄 Full path:", filePath);

    try {
      await fs.access(filePath);
      console.log("✅ File exists");
    } catch (err) {
      console.log("❌ File not found");
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();

    const contentTypes: Record<string, string> = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".pdf": "application/pdf",
      ".json": "application/json",
      ".txt": "text/plain",
    };

    const contentType = contentTypes[ext] || "application/octet-stream";

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  } catch (error) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";