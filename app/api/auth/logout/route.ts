/*
 * Auth API — Logout
 * POST /api/auth/logout — clear JWT cookie
 */

import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ success: true });
  
  // ✅ حذف الكوكي
  response.cookies.delete('platform_token');
  
  return response;
}