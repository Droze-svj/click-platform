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

  // API rewrites for seamless backend integration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://click-platform.onrender.com/api/:path*',
      },
    ]
  },

}

module.exports = nextConfig

