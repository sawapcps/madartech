import { NextRequest, NextResponse } from 'next/server';

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return new NextResponse(null, { status: 200, headers: CORS });
}

export async function POST(req: NextRequest) {
    const response = NextResponse.json(
        { success: true },
        { headers: CORS }
    );

    response.cookies.delete('platform_token');

    return response;
}