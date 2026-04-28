/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  poweredByHeader: false,
  // Both checks enforced at build time. Flip either back to `true` only if
  // a hard deploy gate is needed and there's a known acceptable backlog.
  typescript: { ignoreBuildErrors: false },
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
  rewrites: async () => {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:5001/api/:path*',
      },
    ]
  },
  transpilePackages: ['lucide-react'],
  webpack: (config, { isServer }) => {
    // The video editor pulls in konva → canvas (a native binding) via a
    // dynamic({ ssr: false }) import. konva's package.json `main` points at
    // `lib/index-node.js` which `require()`s the `canvas` package — that in
    // turn requires `../build/Release/canvas.node`, a native binary.
    //
    // Two fixes layered together:
    //   1. `canvas: false` fallback — webpack treats `canvas` as a missing
    //      module and emits an empty stub instead of trying to bundle it.
    //   2. Alias `konva` → `konva/lib/index.js` (the browser entry) on the
    //      client bundle. The browser entry never imports canvas, so the
    //      whole chain is short-circuited at resolution time. Without this,
    //      webpack picks `main` (the Node entry) and we hit the chain even
    //      with the fallback in place, because dev mode logs the error
    //      anyway.
    //   3. Mark konva/canvas/react-konva as externals on the server bundle.
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      canvas: false,
    };
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      // `false` tells webpack to emit an empty stub for every import of
      // `canvas` — short-circuits the native-binding chain in dev and prod.
      canvas: false,
      // Force konva's browser entry. Webpack accepts a bare module subpath
      // here; it resolves through the same pnpm-aware module graph as the
      // app, so we don't need to know the absolute path.
      konva$: 'konva/lib/index.js',
    };

    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        'canvas',
        'konva',
        'react-konva',
      ];
    }

    if (config.module && config.module.rules) {
      // Catch any stray `.node` requires (native bindings) and ignore them.
      // `IgnorePlugin`-style behaviour without needing an extra loader pkg.
      const webpack = require('webpack');
      (config.plugins = config.plugins || []).push(
        new webpack.IgnorePlugin({ resourceRegExp: /\.node$/ })
      );
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
