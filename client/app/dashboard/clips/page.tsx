import { redirect } from 'next/navigation'

// /dashboard/clips has no index view of its own — the real destinations are the
// hub and the auto-clipper. Redirect the bare path to the hub so navigating (or
// linking) to /dashboard/clips lands somewhere instead of 404ing.
export default function ClipsIndexPage() {
  redirect('/dashboard/clips/hub')
}
