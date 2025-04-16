import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    domains: ['cdn-ilcgdkj.nitrocdn.com', 'prefeituradeitacoatiara.com.br'],
  },
  
  allowedDevOrigins: [
    '8081-idx-studio-1744587529099.cluster-kc2r6y3mtba5mswcmol45orivs.cloudworkstations.dev',
  ],
};

export default nextConfig;
