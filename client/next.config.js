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

  // Optimize for iCloud Drive: memory cache, larger chunks to reduce timeout risk
  webpack: (config, { dev, isServer }) => {
    config.cache = { type: 'memory' }
    const splitChunks = config.optimization?.splitChunks
    if (splitChunks && typeof splitChunks === 'object' && !Array.isArray(splitChunks)) {
      config.optimization.splitChunks = { ...splitChunks, maxSize: 500000 }
    }
    return config
  },

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

