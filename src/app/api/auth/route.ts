import { NextRequest, NextResponse } from 'next/server';

const allowedEmails = ['jonasuea@gmail.com', 'outro@dominio.com.br'];

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (allowedEmails.includes(email)) {
      return NextResponse.json({ authorized: true });
    } else {
      return NextResponse.json({ authorized: false, message: 'Email não autorizado' });
    }
  } catch (error) {
    console.error('Erro na API /auth:', error);
    return NextResponse.json({ authorized: false, message: 'Erro interno' }, { status: 500 });
  }
}
