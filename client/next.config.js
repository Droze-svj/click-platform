/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  env: {
    API_URL: process.env.NODE_ENV === 'production'
      ? 'https://click-platform.onrender.com/api'
      : 'http://127.0.0.1:5001/api',
  },
  publicRuntimeConfig: {
    API_URL: process.env.NODE_ENV === 'production'
      ? 'https://click-platform.onrender.com/api'
      : 'http://127.0.0.1:5001/api',
  },
  swcMinify: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },

  webpack: (config, { dev, isServer, webpack }) => {
    config.cache = { type: 'memory' }
    config.resolve.alias.canvas = false
    
    // Suppress Critical dependency warnings (often triggered by onnxruntime-web dynamic requires)
    config.module = config.module || {};
    config.module.exprContextCritical = false;

    config.module.rules.push({
      test: /node_modules[\\/]onnxruntime-web[\\/].*\.mjs$/,
      exclude: /node_modules[\\/]onnxruntime-web[\\/]dist[\\/]ort\.node\.min\.mjs$/,
      type: 'javascript/auto',
      use: [
        {
          loader: 'string-replace-loader',
          options: {
            search: 'import.meta.url',
            replace: '"http://localhost:3010/"', // dummy valid URL
            flags: 'g'
          }
        }
      ]
    });
    if (!dev) {
      const splitChunks = config.optimization?.splitChunks
      if (splitChunks && typeof splitChunks === 'object' && !Array.isArray(splitChunks)) {
        config.optimization.splitChunks = { ...splitChunks, maxSize: 500000 }
      }
    }
    return config
  },

  images: {
    domains: ['localhost', 'commondatastorage.googleapis.com', 'storage.googleapis.com'],
  },

  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: 'http://127.0.0.1:5001/uploads/:path*',
      },
      {
        source: '/api/:path*',
        destination: 'http://127.0.0.1:5001/api/:path*',
      },
    ]
  },
}
module.exports = nextConfig
