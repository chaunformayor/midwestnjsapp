import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // pdfkit reads its built-in font files from node_modules at runtime
  serverExternalPackages: ['pdfkit'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
}

export default nextConfig
