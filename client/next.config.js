/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'http://localhost:5001/api',
  },
  // Minimal configuration to avoid any build issues
  swcMinify: true,
  poweredByHeader: false,

  images: {
    domains: ['localhost'],
  },

  // Restore API proxying for client-side API calls
  async rewrites() {
    const raw = process.env.API_URL || 'http://localhost:5001/api';
    const backendApiBase = raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
    const backendBase = backendApiBase.replace('/api', '');

    return [
      {
        source: '/api/:path*',
        destination: `${backendApiBase}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendBase}/uploads/:path*`,
      },
    ];
  },
}

module.exports = nextConfig

