# Frontend Deployment Guide

This guide covers deploying the Next.js frontend application to production.

## Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager
- Environment variables configured
- Production API endpoint available

## Environment Variables

Create a `.env.production` file (or set environment variables in your hosting platform) with the following:

```bash
# Required
NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api
NODE_ENV=production

# Sentry (Optional but recommended)
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
SENTRY_ORG=your-org
SENTRY_PROJECT=your-project
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0.1
```

### Environment Variable Validation

The application includes environment variable validation. Make sure all required variables are set, especially in production:

- `NEXT_PUBLIC_API_URL` - Must be a valid HTTPS URL in production
- `NODE_ENV` - Should be set to `production`

## Build Process

### Local Build Test

Test the production build locally:

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Start production server
npm start
```

### Build Optimization

The build process includes:

- **Code Splitting**: Automatic code splitting via Next.js
- **Lazy Loading**: Heavy components are lazy-loaded
- **Image Optimization**: AVIF and WebP formats enabled
- **CSS Optimization**: Experimental CSS optimization enabled
- **Console Removal**: Console logs removed in production (except error/warn)
- **Source Maps**: Hidden in production builds (configured via Sentry)

## Deployment Platforms

### Vercel (Recommended)

Vercel is the recommended platform for Next.js applications:

1. **Connect Repository**: Link your GitHub/GitLab repository to Vercel
2. **Configure Environment Variables**: Add all required environment variables in Vercel dashboard
3. **Build Settings**: Vercel auto-detects Next.js, no configuration needed
4. **Deploy**: Push to main branch or deploy manually

**Environment Variables in Vercel:**
- Go to Project Settings → Environment Variables
- Add all variables from `.env.example`
- Set for Production, Preview, and Development environments

### Other Platforms

#### Netlify

1. **Build Command**: `npm run build`
2. **Publish Directory**: `.next`
3. **Environment Variables**: Add in Netlify dashboard → Site Settings → Environment Variables

#### Railway

1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `npm start`
3. **Environment Variables**: Add in Railway dashboard → Variables tab

#### Render

1. **Build Command**: `npm install && npm run build`
2. **Start Command**: `npm start`
3. **Environment Variables**: Add in Render dashboard → Environment tab

#### Self-Hosted (Node.js Server)

```bash
# Install dependencies
npm install --production

# Build application
npm run build

# Start production server
npm start
```

Use a process manager like PM2:

```bash
pm2 start npm --name "nextjs-app" -- start
pm2 save
pm2 startup
```

## Security Headers

The application includes security headers configured in `next.config.js`:

- **Strict-Transport-Security (HSTS)**: Enforces HTTPS
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **X-XSS-Protection**: XSS protection
- **Referrer-Policy**: Controls referrer information
- **Permissions-Policy**: Restricts browser features

These are automatically applied in production builds.

## Performance Optimization

### Before Deployment Checklist

- [ ] All environment variables configured
- [ ] API endpoint is accessible and uses HTTPS
- [ ] Sentry configured (if using error tracking)
- [ ] Build completes without errors
- [ ] Production build tested locally
- [ ] Security headers verified
- [ ] Images optimized (AVIF/WebP)
- [ ] Bundle size acceptable

### Monitoring Performance

- **Lighthouse**: Run Lighthouse audits on production deployment
- **Core Web Vitals**: Monitor LCP, FID, CLS metrics
- **Bundle Analyzer**: Use `@next/bundle-analyzer` to analyze bundle size (optional)

## Troubleshooting

### Build Failures

1. **Environment Variables Missing**: Ensure all required variables are set
2. **API URL Invalid**: Verify `NEXT_PUBLIC_API_URL` is a valid URL
3. **TypeScript Errors**: Fix any TypeScript errors before building
4. **Memory Issues**: Increase Node.js memory limit: `NODE_OPTIONS=--max_old_space_size=4096`

### Runtime Errors

1. **API Connection**: Verify API endpoint is accessible from production
2. **CORS Issues**: Ensure API server allows requests from production domain
3. **Sentry Errors**: Check Sentry configuration if errors aren't being tracked

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm install
      - run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.NEXT_PUBLIC_API_URL }}
          NODE_ENV: production
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

## Post-Deployment

1. **Verify Deployment**: Check all pages load correctly
2. **Test API Integration**: Verify API calls work from production
3. **Check Error Tracking**: Ensure Sentry is receiving errors (if configured)
4. **Monitor Performance**: Use browser dev tools and Lighthouse
5. **Security Headers**: Verify headers are present using browser dev tools

## Rollback Strategy

### Vercel
- Use Vercel dashboard to revert to previous deployment
- Or use Vercel CLI: `vercel rollback`

### Other Platforms
- Keep previous build artifacts for quick rollback
- Use version control tags for deployment tracking
- Maintain backup of working configuration

## Support

For deployment issues:
1. Check build logs for specific errors
2. Verify environment variables are correctly set
3. Test build locally with production environment variables
4. Review Next.js deployment documentation: https://nextjs.org/docs/deployment



