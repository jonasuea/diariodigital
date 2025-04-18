"use client";

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from './firebase'; // Configuração do Firebase

const LoginPage: React.FC = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      const userEmail = user.email;

      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail }),
      });

      const data = await response.json();

      if (data.authorized) {
        console.log('Usuário autorizado. Redirecionando para dashboard...');
        router.push('/dashboard');
      } else {
        alert(data.message || 'Login não autorizado.');
      }
    } catch (error) {
      console.error('Erro ao fazer login com o Google:', error);
      alert('Erro ao tentar fazer login. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="flex flex-col md:flex-row items-stretch w-full max-w-5xl bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Lado esquerdo */}
        <div className="w-full md:w-3/5 bg-blue-100 flex flex-col items-center justify-center p-8 relative">
          <div className="w-4/5 h-32 flex items-center justify-center rounded-lg mb-8">
            <Image
              src="https://cdn-ilcgdkj.nitrocdn.com/FdeVvMZDqfPqUrrZKlHXzkIDWMpgqjam/assets/images/optimized/rev-0f0f589/colegiodompedro.com.br/wp-content/uploads/2022/05/logo-colegiodompedro.png"
              alt="Logo Dom Paulo"
              width={200}
              height={80}
              priority
              className="object-contain" // Adicionado object-contain
              unoptimized
            />
          </div>
          <h2 className="text-2xl text-center text-gray-800 font-semibold mb-2">Escola Dom Paulo</h2>
          <p className="text-gray-700 text-center">Secretaria Municipal de Educação</p>
          <div className="w-4/5 h-32 flex items-center justify-center rounded-lg mt-8">
            <Image
              src="https://prefeituradeitacoatiara.com.br/wp-content/uploads/2024/01/HEADER-CARD-ITACOATIARA.jpg"
              alt="Logo SEMED"
              width={200}
              height={80}
              priority
              className="object-contain" // Adicionado object-contain
              unoptimized
            />
          </div>
        </div>

        {/* Div colorida */}
        <div className="flex flex-col w-2 h-auto">
          <span className="bg-blue-800 flex-1"></span>
          <span className="bg-green-600 flex-1"></span>
          <span className="bg-yellow-300 flex-1"></span>
        </div>

        {/* Lado direito */}
        <div className="w-full md:w-2/5 flex flex-col items-center justify-center p-8">
          <h1 className="text-4xl text-blue-600 font-bold mb-6">Bem-vindo!</h1>
          <p className="text-gray-600 mb-6 text-center">Acesse com sua conta institucional.</p>
          <button
            onClick={handleGoogleLogin}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition duration-300 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? 'Entrando...' : 'Entrar com Google'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
