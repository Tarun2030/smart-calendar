/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  experimental: {
    serverComponentsExternalPackages: ['jspdf', 'jspdf-autotable', 'twilio', 'googleapis'],
  },
};

export default nextConfig;
