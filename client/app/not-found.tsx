import Link from 'next/link'

/**
 * Custom 404 for unmatched routes. Root / should redirect via page.tsx;
 * this handles invalid paths.
 */
export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-white/90 mb-6">This page could not be found.</p>
        <Link
          href="/login"
          className="inline-block px-6 py-3 bg-white/20 hover:bg-white/30 text-white font-semibold rounded-xl transition-colors"
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}
