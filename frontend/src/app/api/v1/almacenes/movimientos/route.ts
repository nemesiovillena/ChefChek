import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${process.env.API_URL || 'http://localhost:3001'}/almacenes/movimientos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add tenant auth header if needed
        ...(request.headers.get('cookie') ? { Cookie: request.headers.get('cookie')! } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: error.message || 'Error al crear movimiento de stock' },
        { status: response.status }
      );
    }

    return NextResponse.json(await response.json());
  } catch (error: any) {
    console.error('Error en stock-movements POST:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}