const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  env: {
    API_URL: process.env.API_URL || 'http://localhost:5001/api',
  },

  // Performance optimizations
  swcMinify: true, // Use SWC for faster minification
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression

  // Enhanced bundle analysis and optimization
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Add bundle analyzer in development
    if (!dev && process.env.ANALYZE === 'true') {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: './bundle-analyzer-report.html',
          openAnalyzer: false,
        })
      )
    }

    // Enhanced chunk optimization for production
    if (!dev) {
      config.optimization = {
        ...config.optimization,
        // Aggressive code splitting
        splitChunks: {
          chunks: 'all',
          maxInitialRequests: 25,
          maxAsyncRequests: 30,
          cacheGroups: {
            // Framework chunk
            framework: {
              test: /[\\/]node_modules[\\/](react|react-dom|next|@next)[\\/]/,
              name: 'framework',
              chunks: 'all',
              priority: 40,
              enforce: true,
            },
            // Large library chunk
            vendor: {
              test: /[\\/]node_modules[\\/](?!react|react-dom|next|@next)/,
              name: 'vendor',
              chunks: 'all',
              priority: 30,
            },
            // UI components chunk
            ui: {
              test: /[\\/]components[\\/]ui[\\/]/,
              name: 'ui-components',
              chunks: 'all',
              priority: 20,
            },
            // Utilities chunk
            utils: {
              test: /[\\/]utils[\\/]|[\\/]hooks[\\/]/,
              name: 'utils',
              chunks: 'all',
              priority: 10,
            },
            // Heavy components (lazy loaded)
            heavy: {
              test: /[\\/]components[\\/](ModernVideoEditor|BulkContentEditor|ElasticsearchSearch)[\\/]/,
              name: 'heavy-components',
              chunks: 'async',
              priority: 5,
              enforce: true,
            },
          },
        },
        // Enhanced tree shaking
        usedExports: true,
        sideEffects: true,
        minimize: true,
        minimizer: [
          ...config.optimization.minimizer,
          new webpack.optimize.ModuleConcatenationPlugin(),
        ],
      }

      // Add compression for production
      const CompressionPlugin = require('compression-webpack-plugin')
      config.plugins.push(
        new CompressionPlugin({
          algorithm: 'gzip',
          test: /\.(js|css|html|svg|json)$/,
          threshold: 1024, // Compress files larger than 1KB
          minRatio: 0.8,
          deleteOriginalAssets: false,
        })
      )

      // Add build metadata
      config.plugins.push(
        new webpack.DefinePlugin({
          __BUILD_ID__: JSON.stringify(buildId),
          __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
          __PRODUCTION__: JSON.stringify(true),
        })
      )
    }

    return config
  },

  // Image optimization
  images: {
    formats: ['image/avif', 'image/webp'], // Enable modern formats
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    domains: ['localhost', 'cdn.click-app.com', 'images.click-app.com'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 60, // 1 minute cache for images
  },

  // Enhanced experimental features for maximum performance
  experimental: {
    optimizeCss: true, // Optimize CSS
    scrollRestoration: true, // Restore scroll position
    legacyBrowsers: false, // Don't support legacy browsers
    esmExternals: 'loose', // Enhanced ESM externals
    webVitalsAttribution: ['CLS', 'LCP'], // Enhanced Web Vitals
    optimizePackageImports: ['lucide-react', '@headlessui/react'], // Optimize package imports
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },

  // Comprehensive security and performance headers
  async headers() {
    const isProduction = process.env.NODE_ENV === 'production'
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://click-app.com'

    return [
      {
        source: '/(.*)',
        headers: [
          // Security headers
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'credentialless'
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin'
          },

          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https://*",
              "connect-src 'self' https://api.click-app.com https://*.click-app.com wss://*.click-app.com https://www.google-analytics.com https://www.googletagmanager.com",
              "media-src 'self' blob: https://*",
              "object-src 'none'",
              "frame-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              isProduction ? "upgrade-insecure-requests" : ""
            ].filter(Boolean).join('; ')
          },

          // Performance headers
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },

          // PWA headers
          {
            key: 'Service-Worker-Allowed',
            value: '/'
          }
        ],
      },

      // API routes - more restrictive
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=300, s-maxage=600, stale-while-revalidate=86400'
          },
          {
            key: 'CDN-Cache-Control',
            value: 'max-age=300'
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'max-age=300'
          }
        ],
      },

      // Static assets - aggressive caching
      {
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ],
      },

      // Images - optimized caching
      {
        source: '/api/uploads/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=2592000'
          }
        ],
      }
    ]
  },

  // Redirects for SEO and user experience
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/app',
        destination: '/dashboard',
        permanent: true,
      },
    ]
  },

  // Rewrites for API proxying (enhanced)
  async rewrites() {
    const raw = process.env.API_URL || 'http://localhost:5001/api'
    const backendApiBase = raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`
    const backendBase = backendApiBase.replace('/api', '')

    return [
      {
        source: '/api/:path*',
        destination: `${backendApiBase}/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${backendBase}/uploads/:path*`,
      },
      // Add health check proxy
      {
        source: '/health',
        destination: `${backendBase}/health`,
      },
    ]
  },
  // CDN Configuration for static assets
  assetPrefix: process.env.CDN_URL || '',
  // Enable SWC minification for better performance
  swcMinify: true,
  // Optimize build output
  output: 'standalone',
  // Compress responses
  compress: true,
  async rewrites() {
    // Allow the frontend to call `/api/...` on the same origin.
    // This avoids CORS headaches and makes local dev usable even when Render is flaky.
    const raw = process.env.API_URL || 'http://localhost:5001/api';
    const backendApiBase = raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
    const backendBase = backendApiBase.replace('/api', ''); // Remove /api for uploads proxy

    // #region agent log
    // Log the effective rewrite target so we can prove where /api/* is being proxied.
    try {
      if (!global.__agentNextConfigLogged) {
        global.__agentNextConfigLogged = true;
        fetch('http://127.0.0.1:7243/ingest/ff7d38f2-f61b-412e-9a79-ebc734d5bd4a', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sessionId: 'debug-session',
            runId: 'run13',
            hypothesisId: 'H13',
            location: 'client/next.config.js:rewrites',
            message: 'next_rewrites_config',
            data: {
              nodeEnv: process.env.NODE_ENV || null,
              apiUrlEnv: process.env.API_URL || null,
              nextPublicApiUrlEnv: process.env.NEXT_PUBLIC_API_URL || null,
              backendApiBase,
              backendBase,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
    } catch {}
    // #endregion

    // Debug instrumentation disabled

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
  // Compiler options
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Transpile packages if needed
  transpilePackages: [],
  // Enhanced image optimization with WebP priority
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    // CDN configuration
    domains: process.env.CDN_DOMAINS ? process.env.CDN_DOMAINS.split(',') : [],
    // Aggressive optimization
    minimumCacheTTL: 86400, // 24 hours
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  // Enhanced experimental features for maximum performance
  experimental: {
    // Enable webpack build worker
    webpackBuildWorker: true,
    // Optimize CSS for better performance
    optimizeCss: true,
    // Enable scroll restoration
    scrollRestoration: true,
    // Code splitting optimizations
    esmExternals: 'loose',
  },
  // Webpack optimizations for code splitting and performance
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Code splitting for large components
    if (!dev && !isServer) {
      // Split vendor chunks
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10,
        },
        // Separate chunk for large libraries
        heavyLibs: {
          test: /[\\/]node_modules[\\/](react-dom|@mui|lodash|moment|axios)[\\/]/,
          name: 'heavy-libs',
          chunks: 'all',
          priority: 20,
        },
        // UI components chunk
        ui: {
          test: /[\\/]components[\\/]ui[\\/]/,
          name: 'ui-components',
          chunks: 'all',
          priority: 15,
        },
      };
    }

    // Add performance optimizations
    if (!dev) {
      // Minimize bundle size
      config.optimization.minimizer.push(
        new webpack.optimize.ModuleConcatenationPlugin()
      );

      // Aggressive code splitting
      config.optimization.splitChunks.chunks = 'all';
      config.optimization.splitChunks.maxInitialRequests = 25;
      config.optimization.splitChunks.maxAsyncRequests = 30;
    }

    return config;
  },
  // Enhanced headers for CDN, caching, and security
  async headers() {
    return [
      // Static assets - aggressive caching
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          },
          {
            key: 'CDN-Cache-Control',
            value: 'max-age=31536000'
          },
          {
            key: 'Vercel-CDN-Cache-Control',
            value: 'max-age=31536000'
          },
        ],
      },
      // Images - long cache
      {
        source: '/api/uploads/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400'
          },
        ],
      },
      // API responses - short cache for GET requests
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'private, max-age=300, s-maxage=300'
          },
        ],
      },
      // Main application pages
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          },
          // Performance headers
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
    ]
  },
}

// Only enable Sentry webpack plugin in production builds.
// In dev, it can interfere with Next's client runtime asset filenames, causing missing `main-app.js` / CSS files.
if (process.env.NODE_ENV !== 'production') {
  module.exports = nextConfig
  return
}

module.exports = withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: '/monitoring',

  // Hides source maps from generated client bundles
  hideSourceMaps: true,

  // Automatically tree-shake Sentry logger statements to reduce bundle size
  disableLogger: true,

  // Enables automatic instrumentation of Vercel Cron Monitors.
  automaticVercelMonitors: true,
})

