// src/pages/dashboard.tsx
import jwt from 'jsonwebtoken';
import { parse } from 'cookie';
import { GetServerSideProps } from 'next';

type Props = {
  email: string;
};

export default function Dashboard({ email }: Props) {
  const handleLogout = async () => {
    await fetch('/api/logout');
    window.location.href = '/';
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-8">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow p-6 flex flex-col items-center">
        <div className="flex justify-between w-full mb-6">
          <h1 className="text-2xl font-bold text-blue-600">Painel da Escola</h1>
          <button
            onClick={handleLogout}
            className="text-sm bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
          >
            Sair
          </button>
        </div>
        <p className="text-gray-700 text-center">
          Bem-vindo, <strong>{email}</strong>!
        </p>
      </div>
    </div>
  );
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const cookies = parse(context.req.headers.cookie || '');
  const token = cookies.authToken;

  if (!token) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'segredo-supersecreto');
    return {
      props: {
        email: decoded.email,
      },
    };
  } catch (err) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }
};
