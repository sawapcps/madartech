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

    if (!filename) {
      return NextResponse.json({ error: "Filename required" }, { status: 400 });
    }

    const filePath = path.join(STORAGE_DIR, filename);

    try {
      await fs.access(filePath);
    } catch (err) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    const fileBuffer = await fs.readFile(filePath);
    const ext = path.extname(filename).toLowerCase();

    // ✅ جميع أنواع الملفات
    const contentTypes: Record<string, string> = {
      // صور
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".gif": "image/gif",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".bmp": "image/bmp",
      ".ico": "image/x-icon",
      ".tiff": "image/tiff",
      // تطبيقات أندرويد
      ".apk": "application/vnd.android.package-archive",
      ".aab": "application/octet-stream",
      // تطبيقات iOS
      ".ipa": "application/octet-stream",
      // تطبيقات ويندوز
      ".exe": "application/x-msdownload",
      ".msi": "application/x-msi",
      ".msix": "application/x-msix",
      ".appx": "application/x-appx",
      // تطبيقات ماك
      ".dmg": "application/x-apple-diskimage",
      ".pkg": "application/x-newton-compatible-pkg",
      ".app": "application/x-apple-application",
      // مستندات
      ".pdf": "application/pdf",
      ".doc": "application/msword",
      ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ".txt": "text/plain",
      ".rtf": "application/rtf",
      // جداول
      ".xls": "application/vnd.ms-excel",
      ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".csv": "text/csv",
      // عروض
      ".ppt": "application/vnd.ms-powerpoint",
      ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      // فيديو
      ".mp4": "video/mp4",
      ".avi": "video/x-msvideo",
      ".mov": "video/quicktime",
      ".mkv": "video/x-matroska",
      ".webm": "video/webm",
      // صوت
      ".mp3": "audio/mpeg",
      ".wav": "audio/wav",
      ".ogg": "audio/ogg",
      ".flac": "audio/flac",
      // ملفات مضغوطة
      ".zip": "application/zip",
      ".rar": "application/vnd.rar",
      ".7z": "application/x-7z-compressed",
      ".tar": "application/x-tar",
      ".gz": "application/gzip",
      // كود وبيانات
      ".json": "application/json",
      ".xml": "application/xml",
      ".html": "text/html",
      ".css": "text/css",
      ".js": "text/javascript",
      ".ts": "text/typescript",
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
