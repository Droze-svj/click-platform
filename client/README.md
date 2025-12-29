# Click Frontend

Next.js frontend application for the Click AI-powered content creation platform.

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn package manager

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables template
cp .env.example .env.local

# Edit .env.local with your configuration
```

### Development

```bash
# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Project Structure

```
client/
├── app/                    # Next.js app directory
│   ├── dashboard/         # Dashboard pages
│   ├── login/             # Authentication pages
│   └── layout.tsx         # Root layout
├── components/            # React components
├── hooks/                 # Custom React hooks
├── utils/                 # Utility functions
├── lib/                   # Library code (API client, etc.)
├── contexts/              # React contexts (Toast, etc.)
└── public/                # Static assets
```

## Features

- ✨ Modern UI with Tailwind CSS
- 🚀 Server-side rendering with Next.js
- 📱 Responsive design for mobile and desktop
- ♿ Accessibility features (ARIA labels, keyboard navigation)
- 🎨 Toast notifications for user feedback
- 🔒 Security headers and best practices
- 📊 Error tracking with Sentry (optional)
- 🧪 Testing setup with Jest and React Testing Library

## Environment Variables

See `.env.example` for required environment variables.

Required:
- `NEXT_PUBLIC_API_URL` - Backend API URL

Optional:
- `NEXT_PUBLIC_SENTRY_DSN` - Sentry DSN for error tracking
- `SENTRY_ORG` - Sentry organization
- `SENTRY_PROJECT` - Sentry project name

## Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage

## Tech Stack

- **Framework**: Next.js 14
- **React**: 18.2
- **Styling**: Tailwind CSS
- **TypeScript**: 5.3
- **Testing**: Jest, React Testing Library
- **Error Tracking**: Sentry
- **HTTP Client**: Axios

## Documentation

- [Deployment Guide](./DEPLOYMENT.md)
- [Testing Guide](./__tests__/README.md)

## Contributing

1. Follow the existing code style
2. Write tests for new features
3. Update documentation as needed
4. Ensure all tests pass before submitting

## License

See main repository LICENSE file.



