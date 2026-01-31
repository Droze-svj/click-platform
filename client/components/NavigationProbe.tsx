'use client'

import { useEffect } from 'react'

declare global {
  interface Window {
    __navigationProbeInstalled?: boolean
    __navigationProbeMounts?: number
    __navigationProbeState?: {
      installed?: boolean
      origPushState?: History['pushState']
      origReplaceState?: History['replaceState']
      origAssign?: ((url: string) => void) | null
      origReplace?: ((url: string) => void) | null
      origReload?: (() => void) | null
      onPop?: (() => void) | null
      onErr?: ((ev: ErrorEvent) => void) | null
      onRej?: ((ev: PromiseRejectionEvent) => void) | null
    }
  }
}

export default function NavigationProbe() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    // React StrictMode runs effects twice (mount -> cleanup -> mount).
    // If cleanup restores the original methods and we bail out on the second mount, we lose instrumentation.
    window.__navigationProbeMounts = (window.__navigationProbeMounts || 0) + 1
    window.__navigationProbeInstalled = true

    const safeStack = () => {
      try {
        const s = String(new Error().stack || '')
        return s.split('\n').slice(0, 10).join('\n')
      } catch {
        return ''
      }
    }

    const send = (message: string, data: Record<string, any>) => {
      console.log('NavigationProbe:', message, data)
      // Send to debug endpoint if available (use relative path)
      fetch('/api/debug/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          component: 'NavigationProbe',
          message,
          data: { ...data, timestamp: Date.now() }
        }),
      }).catch(() => {}) // Ignore errors in debug logging
    }

    const ua = (() => {
      try {
        return String(navigator.userAgent || '')
      } catch {
        return ''
      }
    })()
    const isSafari =
      /Safari/i.test(ua) && !/Chrome|Chromium|Edg|OPR|Opera/i.test(ua)

    send('nav_probe_installed', {
      href: window.location.href,
      hasToken: !!localStorage.getItem('token'),
      tokenLength: (localStorage.getItem('token') || '').length,
      isSafari,
    })

    // Patch history/location in an idempotent way (survives StrictMode cleanup/mount).
    if (!window.__navigationProbeState) window.__navigationProbeState = {}
    const state = window.__navigationProbeState
    if (!state.installed) {
      // Patch history (captures Next router pushes which use history APIs)
      state.origPushState = history.pushState.bind(history)
      state.origReplaceState = history.replaceState.bind(history)

      try {
        history.pushState = ((s: any, t: string, url?: string | URL | null) => {
          send('history_pushState', {
            from: window.location.href,
            to: url ? String(url) : null,
            stack: safeStack(),
          })
          return state.origPushState!(s, t, url as any)
        }) as any
      } catch (e: any) {
        send('history_pushState_patch_failed', { href: window.location.href, message: String(e?.message || e || '') })
      }

      try {
        history.replaceState = ((s: any, t: string, url?: string | URL | null) => {
          send('history_replaceState', {
            from: window.location.href,
            to: url ? String(url) : null,
            stack: safeStack(),
          })
          return state.origReplaceState!(s, t, url as any)
        }) as any
      } catch (e: any) {
        send('history_replaceState_patch_failed', { href: window.location.href, message: String(e?.message || e || '') })
      }

      // Patch location.assign/replace/reload (captures hard navigations)
      const loc: any = window.location as any
      // NOTE: Safari can make Location properties read-only / non-extensible.
      // Always guard these assignments so we never crash the app in dev.
      if (isSafari) {
        // Avoid even attempting the assignment in Safari (it throws and can still trip dev overlays in some cases).
        state.origAssign = null
        state.origReplace = null
        state.origReload = null
        send('safari_skip_location_patching', { href: window.location.href })
      } else {
      try {
        state.origAssign = loc.assign?.bind(loc) || null
        if (state.origAssign) {
          try {
            loc.assign = (url: string) => {
              send('location_assign', { from: window.location.href, to: String(url), stack: safeStack() })
              return state.origAssign!(url)
            }
            send('location_assign_patch_ok', { href: window.location.href })
          } catch (e: any) {
            send('location_assign_patch_failed', {
              href: window.location.href,
            })
          }
        } else {
          send('location_assign_patch_missing', { href: window.location.href })
        }
      } catch (e: any) {
        send('location_assign_patch_failed', { href: window.location.href, message: String(e?.message || e || '') })
      }

      try {
        state.origReplace = loc.replace?.bind(loc) || null
        if (state.origReplace) {
          try {
            loc.replace = (url: string) => {
              send('location_replace', { from: window.location.href, to: String(url), stack: safeStack() })
              return state.origReplace!(url)
            }
            send('location_replace_patch_ok', { href: window.location.href })
          } catch (e: any) {
            send('location_replace_patch_failed', {
              href: window.location.href,
            })
          }
        } else {
          send('location_replace_patch_missing', { href: window.location.href })
        }
      } catch (e: any) {
        send('location_replace_patch_failed', { href: window.location.href, message: String(e?.message || e || '') })
      }

      try {
        state.origReload = loc.reload?.bind(loc) || null
        if (state.origReload) {
          try {
            loc.reload = () => {
              send('location_reload', { href: window.location.href, stack: safeStack() })
              return state.origReload!()
            }
            send('location_reload_patch_ok', { href: window.location.href })
          } catch (e: any) {
            send('location_reload_patch_failed', { href: window.location.href, message: String(e?.message || e || '') })
          }
        } else {
          send('location_reload_patch_missing', { href: window.location.href })
        }
      } catch (e: any) {
        send('location_reload_patch_failed', { href: window.location.href, message: String(e?.message || e || '') })
      }
      }

      // Observe popstate (back/forward)
      state.onPop = () => send('popstate', { href: window.location.href })
      window.addEventListener('popstate', state.onPop)

      // Capture runtime errors that often precede full reloads
      state.onErr = (ev: ErrorEvent) => {
        send('window_error', {
          filename: String(ev.filename || ''),
          lineno: Number(ev.lineno || 0),
          colno: Number(ev.colno || 0),
        })
      }
      state.onRej = (ev: PromiseRejectionEvent) => {
        const r: any = (ev as any).reason
        send('unhandledrejection', {
          name: String(r?.name || ''),
        })
      }
      window.addEventListener('error', state.onErr)
      window.addEventListener('unhandledrejection', state.onRej)

      state.installed = true
    }

    // Try to intercept location.href assignments (e.g., window.location.href = '/login')
    // NOTE: Some browsers disallow redefining this; we log success/failure either way.
    try {
      if (isSafari) {
        send('safari_skip_location_href_patch', { href: window.location.href })
      } else {
      const proto: any = (window.location as any).__proto__ || (window as any).Location?.prototype
      if (proto) {
        const desc = Object.getOwnPropertyDescriptor(proto, 'href')
        // Only attempt if configurable; redefining a non-configurable accessor will throw in Safari.
        if (desc && desc.configurable && typeof desc.set === 'function' && typeof desc.get === 'function') {
          Object.defineProperty(proto, 'href', {
            configurable: desc.configurable,
            enumerable: desc.enumerable,
            get: function () {
              return desc.get!.call(this)
            },
            set: function (v: any) {
              send('location_href_set', {
                from: (() => {
                  try {
                    return String(desc.get!.call(this))
                  } catch {
                    return String(window.location.href)
                  }
                })(),
                to: String(v),
                stack: safeStack(),
              })
              return desc.set!.call(this, v)
            },
          })
          send('location_href_patch_ok', { href: window.location.href })
        } else if (desc && !desc.configurable) {
          send('location_href_patch_skipped_non_configurable', { href: window.location.href })
        } else {
          send('location_href_patch_missing_descriptor', { href: window.location.href })
        }
      } else {
        send('location_href_patch_no_proto', { href: window.location.href })
      }
      }
    } catch (e: any) {
      send('location_href_patch_failed', {
        href: window.location.href,
      })
    }

    return () => {
      window.__navigationProbeMounts = Math.max(0, (window.__navigationProbeMounts || 1) - 1)
      // Only restore originals when no mounts remain (prevents StrictMode cleanup from disabling logging).
      if ((window.__navigationProbeMounts || 0) === 0 && window.__navigationProbeState?.installed) {
        const st = window.__navigationProbeState
        if (st?.onPop) window.removeEventListener('popstate', st.onPop)
        if (st?.onErr) window.removeEventListener('error', st.onErr)
        if (st?.onRej) window.removeEventListener('unhandledrejection', st.onRej)
        if (st?.origPushState) history.pushState = st.origPushState as any
        if (st?.origReplaceState) history.replaceState = st.origReplaceState as any
        const loc: any = window.location as any
        // Safari can make these Location props read-only; never throw during StrictMode cleanup.
        if (st?.origAssign) {
          try {
            loc.assign = st.origAssign
            send('location_assign_restore_ok', { href: window.location.href })
          } catch (e: any) {
            send('location_assign_restore_failed', {
              href: window.location.href,
            })
          }
        }
        if (st?.origReplace) {
          try {
            loc.replace = st.origReplace
            send('location_replace_restore_ok', { href: window.location.href })
          } catch (e: any) {
            send('location_replace_restore_failed', {
              href: window.location.href,
            })
          }
        }
        if (st?.origReload) {
          try {
            loc.reload = st.origReload
            send('location_reload_restore_ok', { href: window.location.href })
          } catch (e: any) {
            send('location_reload_restore_failed', {
              href: window.location.href,
            })
          }
        }
        st.installed = false
      }
    }
  }, [])

  return null
}


