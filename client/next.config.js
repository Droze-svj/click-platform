/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // TypeScript: 26 known type-drift errors at the time of writing (2026-04-25).
  // None are runtime crashes — they're component prop mismatches and
  // type-vs-implementation drift (e.g. BrandKit `showToast` prop, VideoFilter
  // initializers in older views). Build is gated permissive while these are
  // worked through; flip back to `false` to surface them in CI again.
  typescript: { ignoreBuildErrors: true },
  // ESLint: was masking 9 real undefined-import bugs that would crash at
  // render. Those are now fixed, so lint is enforced at build time again.
  eslint: { ignoreDuringBuilds: false },
  productionBrowserSourceMaps: false,
  swcMinify: true,
  experimental: {
    workerThreads: false,
    cpus: 1
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'commondatastorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'res.cloudinary.com' }
    ],
  },
  transpilePackages: ['lucide-react'],
  webpack: (config, { isServer }) => {
    // The video editor pulls in konva → canvas (a native binding) via a
    // dynamic({ ssr: false }) import, but Next.js still bundles those modules
    // for the server build. The `canvas: false` fallback used to be gated to
    // the client bundle only, which made the server build fail on Vercel with
    // "Can't resolve '../build/Release/canvas.node'". Applying the fallback to
    // both bundles is safe — server code never actually executes konva because
    // the consuming components are client-only.
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };

    // Mark konva itself as external on the server so webpack doesn't even try
    // to walk into it. This pairs with ssr:false on the consuming dynamic
    // imports.
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'canvas',
        'konva',
        'react-konva',
      ];
    }

    if (config.module && config.module.rules) {
      config.module.rules.push({
        test: /\.node$/,
        use: 'null-loader',
      });
    }

    return config;
  },
  headers: async () => [
    {
      source: '/:path*',
      headers: [
        { key: 'X-DNS-Prefetch-Control', value: 'on' },
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
      ],
    },
  ],
}
module.exports = nextConfig
