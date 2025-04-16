// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';
import { verify } from 'jsonwebtoken';

const PUBLIC_ROUTES = ['/', '/api/auth', '/api/logout', '/favicon.ico'];

const JWT_SECRET = process.env.JWT_SECRET || 'segredo-supersecreto';

export function middleware(req: NextRequest) {  
  console.log('Middleware executed');
  const { pathname } = req.nextUrl;
  const response = NextResponse.next(); // Cria uma resposta base

  // Adiciona os cabeçalhos COOP a *todas* as respostas
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups'); // ou 'same-origin'
  // Se usar 'same-origin', descomente a linha abaixo e ajuste as origens permitidas se necessário
  // response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');

  // 1. Permite rotas públicas
  if (PUBLIC_ROUTES.includes(pathname) || pathname.startsWith('/_next')) {
    return response; // Retorna a resposta com os cabeçalhos COOP
  }

  // 2. Verifica o token do cookie
  const token = req.cookies.get('authToken')?.value;

  if (!token) {
    const loginUrl = new URL('/', req.url);
    return NextResponse.redirect(loginUrl);
  }

  try {
    verify(token, JWT_SECRET);
    return response; // Retorna a resposta com os cabeçalhos COOP
  } catch (error) {
    const loginUrl = new URL('/', req.url);
    return NextResponse.redirect(loginUrl);
  }
}

// 3. Define onde o middleware deve atuar
export const config = {
  matcher: '/((?!api|_next/static|_next/image|favicon.ico).*)',
};
