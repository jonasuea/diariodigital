"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-[url('https://picsum.photos/1920/1080')] bg-cover">
      <Card className="w-full max-w-4xl shadow-xl rounded-xl overflow-hidden">
        <div className="flex flex-row h-96">
          {/* Left Side: Logo and Illustration */}
          <div className="w-1/2 p-8 flex flex-col justify-between bg-green-100">
            <div>
              {/* Logo and App Title */}
              <div className="flex items-center text-2xl font-semibold text-gray-800">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="mr-2 text-green-500"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15v-4h2v4h-2zm0-8V7h2v3h-2z" />
                </svg>
                SchoolSync Journal
              </div>
              <div className="mt-2">
                <img
                  src="https://picsum.photos/400/300"
                  alt="Illustration"
                  className="rounded-lg shadow-md"
                />
              </div>
            </div>
            {/* SEDUC Logos */}
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                SEDUC Amazonas
              </span>
            </div>
          </div>

          {/* Right Side: Welcome and Login */}
          <div className="w-1/2 p-8 flex flex-col justify-center items-center bg-white">
            {/* Brazilian Flag Inspired Top Bar */}
            <div className="w-full h-2 flex">
              <div className="bg-green-500 w-1/3"></div>
              <div className="bg-yellow-500 w-1/3"></div>
              <div className="bg-blue-500 w-1/3"></div>
            </div>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl font-semibold text-gray-900">
                Bem-vindo!
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-md text-gray-700 mb-4 text-center">
                Acessar com a conta institucional.
              </p>
              <Button className="w-full bg-blue-600 text-white hover:bg-blue-700 font-semibold rounded-md shadow">
                Entrar
              </Button>
            </CardContent>
          </div>
        </div>
      </Card>
    </div>
  );
}
