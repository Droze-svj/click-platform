/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled to prevent console spam from double renders in development
  env: {
    API_URL: 'https://click-platform.onrender.com/api',
  },
  // Make API URL available to frontend
  publicRuntimeConfig: {
    API_URL: 'https://click-platform.onrender.com/api',
  },
  // Minimal configuration to avoid any build issues
  swcMinify: true,
  poweredByHeader: false,

  images: {
    domains: ['localhost'],
  },

  // API rewrites for seamless backend integration
  // Note: Next.js API routes in app/api/ are handled BEFORE rewrites
  // Routes like /api/debug/*, /api/uploads/*, and /api/auth/me are handled by Next.js API routes
  async rewrites() {
    return [
      {
        // Rewrite /api/* routes to backend
        // Next.js API routes (app/api/*/route.ts) are checked FIRST, so they won't be rewritten
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
        // Note: Next.js automatically forwards headers including Authorization, Host, etc.
      },
    ]
  },

}

module.exports = nextConfig

