// Dashboard URL prefixes that are folders, not pages: they only group child
// routes (/dashboard/growth/seo, /dashboard/video/edit/<id>, …) and have no
// page.tsx of their own. The header breadcrumb renders these parents as plain
// text — as links they 404'd (and Next's prefetch of them logged a 404 on
// every child page). Guarded against the app/ tree by
// __tests__/breadcrumbRoutes.test.ts, so a new folder can't slip through.
const PARENTS_WITHOUT_PAGE: RegExp[] = [
  /^\/dashboard\/growth$/,
  /^\/dashboard\/clients(\/[^/]+)?$/,
  /^\/dashboard\/analytics\/(insights|posts)$/,
  /^\/dashboard\/video\/edit$/,
]

/** True when a breadcrumb href is a real page worth linking to. */
export function crumbHasPage(href: string): boolean {
  return !PARENTS_WITHOUT_PAGE.some((re) => re.test(href))
}
