// src/pages/api/check-auth.js
import jwt from 'jsonwebtoken';

export default function handler(req, res) {
  const token = req.cookies?.authToken;
  const JWT_SECRET = process.env.JWT_SECRET || 'segredo-supersecreto';

  if (!token) {
    return res.status(401).json({ message: 'Token não encontrado' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return res.status(200).json({ email: decoded.email, authorized: true });
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
}
