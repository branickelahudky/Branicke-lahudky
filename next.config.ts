import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  serverExternalPackages: ['puppeteer', 'puppeteer-core', '@sparticuz/chromium', 'nodemailer', 'sharp'],
  // Logo faktury se čte přes fs (invoice-template.ts) — bez explicitního
  // trasování by se do serverless bundle nedostalo
  outputFileTracingIncludes: {
    '/**': ['./public/logo-markes.jpg'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.myshoptet.com',
      },
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
      {
        protocol: 'https',
        hostname: 'pub-3ae9cfad8d26402e92261fe4f5a5d825.r2.dev',
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}

export default nextConfig
