// src/pages/api/logout.js
import { serialize } from 'cookie';

export default function handler(req, res) {
  res.setHeader('Set-Cookie', serialize('authToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0, // Remove o cookie
  }));

  return res.status(200).json({ message: 'Logout feito com sucesso!' });
}
