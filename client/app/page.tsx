import { redirect } from 'next/navigation'

/**
 * Root route: redirect to login. Server-side redirect avoids client hydration
 * and ensures / always resolves (prevents 404 on GET /).
 */
export default function Home() {
  redirect('/login')
}
