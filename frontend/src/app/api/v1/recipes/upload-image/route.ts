import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Forward auth headers from the original request
    const authHeader = request.headers.get('Authorization');
    const tenantSlug = request.headers.get('X-Tenant-Slug');

    const headers: Record<string, string> = {};
    if (authHeader) headers['Authorization'] = authHeader;
    if (tenantSlug) headers['X-Tenant-Slug'] = tenantSlug;

    const res = await fetch(`${API_BASE_URL}/v1/recipes/upload-image`, {
      method: 'POST',
      body: formData,
      headers,
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: { message: error.message || 'Upload failed' } },
      { status: 500 },
    );
  }
}
