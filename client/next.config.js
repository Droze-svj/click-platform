/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: '/api', // Use Next.js API routes for now
  },
  // Minimal configuration to avoid any build issues
  swcMinify: true,
  poweredByHeader: false,

  images: {
    domains: ['localhost'],
  },

}

module.exports = nextConfig

