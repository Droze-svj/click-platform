/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: 'https://click-platform.onrender.com/api',
  },
  // Minimal configuration to avoid any build issues
  swcMinify: true,
  poweredByHeader: false,

  images: {
    domains: ['localhost'],
  },

}

module.exports = nextConfig

