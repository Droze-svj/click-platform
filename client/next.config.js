/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
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

  // Enable static export for production deployment
  output: 'export',
  trailingSlash: true,

  // API rewrites for seamless backend integration (only in development)
  ...(process.env.NODE_ENV === 'development' ? {
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://localhost:5001/api/:path*',
        },
      ]
    }
  } : {}),

}

module.exports = nextConfig

