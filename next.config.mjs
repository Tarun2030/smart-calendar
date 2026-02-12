/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  // Ensure proper handling of external packages in server components
  serverExternalPackages: ['jspdf', 'jspdf-autotable', 'twilio', 'googleapis'],
};

export default nextConfig;
