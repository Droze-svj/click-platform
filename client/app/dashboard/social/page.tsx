'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Twitter, Linkedin, Facebook, Instagram, Youtube, Video,
  Unlink, CheckCircle, Link2, Globe, RefreshCw, Plus,
} from 'lucide-react'
import { useOAuth } from '../../../hooks/useOAuth'
import { useAuth } from '../../../hooks/useAuth'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import ToastContainer from '../../../components/ToastContainer'
import { useToast } from '../../../contexts/ToastContext'
import { useTranslation } from '../../../hooks/useTranslation'
import { cn } from '../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Badge,
  SectionHeader,
} from '../../../components/ui'

interface PlatformAccount {
  id?: string
  accountId?: string
  platform: string
  platform_user_id: string
  username: string
  display_name: string
  avatar?: string
  is_connected?: boolean
  isPrimary?: boolean
  isActive?: boolean
  metadata?: any
  created_at?: string
  connected_at?: string | null
}

// Multi-account: each platform key now stores an array. A user can have
// 0..N accounts per platform. The first entry is the primary; `isActive`
// marks the one the worker publishes from when no accountId is specified.
interface ConnectedAccounts {
  twitter?: PlatformAccount[] | null
  linkedin?: PlatformAccount[] | null
  facebook?: PlatformAccount[] | null
  instagram?: PlatformAccount[] | null
  youtube?: PlatformAccount[] | null
  tiktok?: PlatformAccount[] | null
  google?: PlatformAccount[] | null
  [key: string]: PlatformAccount[] | null | undefined
}

const PLATFORM_CONFIG: Record<string, {
  name: string;
  icon: any;
  color: string;
}> = {
  twitter: {
    name: 'X / Twitter',
    icon: Twitter,
    color: 'text-slate-600 dark:text-slate-400'
  },
  youtube: {
    name: 'YouTube',
    icon: Youtube,
    color: 'text-rose-600 dark:text-rose-500'
  },
  instagram: {
    name: 'Instagram',
    icon: Instagram,
    color: 'text-pink-600 dark:text-pink-500'
  },
  linkedin: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: 'text-blue-600 dark:text-blue-500'
  },
  facebook: {
    name: 'Facebook',
    icon: Facebook,
    color: 'text-indigo-600 dark:text-indigo-500'
  },
  tiktok: {
    name: 'TikTok',
    icon: Video,
    color: 'text-fuchsia-600 dark:text-fuchsia-500'
  },
  // Google = read-only integration. Different OAuth client from YouTube
  // because it asks for the broader scope set: YouTube Analytics
  // (channel views / retention), Search Console (top queries / CTR), and
  // basic profile. The data flows into getTopPerformingPlaybook so the
  // AI's suggestions improve over time based on what's actually winning
  // on the creator's own channel + site. Doesn't replace the YouTube
  // card — that one handles video UPLOADS; this one handles ANALYTICS.
  google: {
    name: 'Google Analytics',
    icon: Globe,
    color: 'text-sky-600 dark:text-sky-400',
  },
}

export default function SocialPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth() as any
  const { showToast } = useToast()
  const { t } = useTranslation()
  const { connect, disconnect, getConnections, loading: oauthLoading } = useOAuth()

  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [accounts, setAccounts] = useState<ConnectedAccounts | null>(null)

  // Stabilise `loadAccounts` via a ref so the effect below can call the
  // latest closure without putting it in the dep array. Without this,
  // `getConnections` and `showToast` (returned from non-memoising hooks)
  // changed identity every render, recreating `loadAccounts`, which made
  // the mount effect re-fire and call `setAccounts`, which re-rendered,
  // which recreated `loadAccounts` again — the React "Maximum update
  // depth exceeded" loop the dashboard was caught in.
  const loadAccountsRef = useRef<() => Promise<void>>(async () => {})
  loadAccountsRef.current = async () => {
    try {
      setLoading(true)
      const connections = await getConnections()
      setAccounts(connections as ConnectedAccounts)
    } catch {
      showToast(t('socialPage.toastSyncFailed'), 'error')
    } finally {
      setLoading(false)
    }
  }
  const loadAccounts = useCallback(() => loadAccountsRef.current(), [])

  useEffect(() => {
    loadAccounts()

    const successParam = searchParams.get('success')
    const errorParam = searchParams.get('error')
    const platformParam = searchParams.get('platform')

    if (successParam === 'true' && platformParam) {
      showToast(t('socialPage.toastUplinkEstablished', { platform: platformParam.toUpperCase() }), 'success')
    } else if (errorParam) {
      showToast(t('socialPage.toastUplinkFailure', { error: errorParam }), 'error')
    }
    // Intentionally omit `loadAccounts` (stable via ref) and `showToast`
    // (not memoised by useToast) from the dep array — including them
    // caused an infinite render loop. We only re-run when the URL's
    // search params change, which is the only meaningful trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const connectAccount = async (platform: string) => {
    try {
      setConnecting(platform)
      await connect(platform)
    } catch (err: any) {
      showToast(err.message || t('socialPage.toastUplinkErr', { platform: platform.toUpperCase() }), 'error')
      setConnecting(null)
    }
  }

  /**
   * Disconnect one specific account (multi-account aware) or the whole
   * platform (when accountId is undefined). The new backend forwards
   * accountId to the per-platform service so only the requested entry
   * is removed; remaining accounts stay connected.
   */
  const disconnectAccount = async (platform: string, accountId?: string) => {
    const label = accountId
      ? t('socialPage.severLabelSelected', { platform: platform.toUpperCase() })
      : t('socialPage.severLabelEvery', { platform: platform.toUpperCase() })
    if (!confirm(t('socialPage.severConfirm', { label }))) return
    try {
      setDisconnecting(`${platform}:${accountId || 'all'}`)
      await disconnect(platform, accountId)
      showToast(t('socialPage.toastLinkSevered', { platform: platform.toUpperCase() }), 'success')
      await loadAccounts()
    } catch (err: any) {
      showToast(err.message || t('socialPage.toastDecouplingErr', { platform: platform.toUpperCase() }), 'error')
    } finally {
      setDisconnecting(null)
    }
  }

  /**
   * Switch which connected account is active for one-account UIs (e.g.
   * the editor's "post to" dropdown). The worker uses this as the
   * default when a scheduled post has no explicit accountId.
   */
  const setActive = async (platform: string, accountId: string) => {
    try {
      const { apiPost } = await import('../../../lib/api')
      await apiPost(`/oauth/${platform}/active`, { accountId })
      showToast(t('socialPage.toastActiveSwitched', { platform: platform.toUpperCase() }), 'success')
      await loadAccounts()
    } catch (err: any) {
      showToast(err.message || t('socialPage.toastActiveSwitchFailed', { platform }), 'error')
    }
  }

  if (loading) {
    return (
      <div className="ds-bg-mesh-soft min-h-screen flex flex-col items-center justify-center gap-4 py-48" aria-busy="true" aria-label={t('socialPage.scanningNodes')}>
        <RefreshCw size={32} className="text-primary animate-spin" aria-hidden />
        <p className="ds-text-label text-theme-muted">{t('socialPage.scanningNodes')}</p>
      </div>
    )
  }

  const activeCount = accounts ? Object.values(accounts).filter(Boolean).length : 0

  return (
    <ErrorBoundary>
      <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-[1700px] mx-auto overflow-x-hidden text-theme-primary">
        <ToastContainer />

        {/* ── Header (global DashboardHeader provides the breadcrumb) ── */}
        <SectionHeader
          as="h1"
          title={t('socialPage.title')}
          description={t('socialPage.activeCount', { count: activeCount })}
          className="mb-6"
          actions={
            <Button
              variant="secondary"
              size="md"
              leftIcon={<RefreshCw size={16} aria-hidden />}
              onClick={loadAccounts}
            >
              {t('socialPage.refreshAccounts')}
            </Button>
          }
        />

        {/* ── Platform Grid (auto-fit so cards reflow at any width) ── */}
        <div className="ds-bento-grid">
          {Object.entries(PLATFORM_CONFIG).map(([id, cfg]) => {
            // Multi-account: each platform's slot is now an array. The
            // first entry is rendered as the primary "active" account,
            // and the rest stack below it with their own switch /
            // disconnect controls.
            const rawSlot = accounts?.[id]
            const accountList: PlatformAccount[] = Array.isArray(rawSlot)
              ? rawSlot
              : (rawSlot ? [rawSlot as unknown as PlatformAccount] : [])
            const primary = accountList.find((a) => a.isPrimary) || accountList[0] || null
            const isConnecting = connecting === id
            const isActive = accountList.length > 0
            const isTikTok = id === 'tiktok'
            const Icon = cfg.icon

            return (
              <Panel key={id} variant="bento" className="ds-bento-2x1 flex flex-col">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-accent">
                      <Icon size={22} className={cfg.color} aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <h3 className="ds-text-h3 text-theme-primary truncate">{cfg.name}</h3>
                      <p className="ds-text-caption truncate">{t(`socialPage.platformDesc.${id}`)}</p>
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                        : isTikTok
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : 'ds-surface-subtle text-theme-muted'
                    )}
                  >
                    {isActive ? t('socialPage.statusUplinked') : isTikTok ? t('socialPage.statusComingSoon') : t('socialPage.statusOffline')}
                  </Badge>
                </div>

                {isActive && primary ? (
                  <div className="space-y-2.5 mt-auto pt-5 border-t border-[var(--border-subtle)]">
                    {/* One row per connected account on this platform.
                        The active account is marked; non-active rows have
                        a "Make active" button. Each row has its own
                        disconnect. */}
                    {accountList.map((acct) => {
                      const aid = acct.accountId || acct.platform_user_id
                      const rowBusy = disconnecting === `${id}:${aid}`
                      return (
                        <div key={aid} className="ds-surface-subtle flex items-center gap-3 p-3">
                          <div className="relative flex-shrink-0">
                            {acct.avatar ? (
                              <img src={acct.avatar} alt={acct.username} className="h-10 w-10 rounded-lg object-cover" />
                            ) : (
                              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
                                <Icon size={18} className="text-theme-muted" aria-hidden />
                              </span>
                            )}
                            {acct.isActive && (
                              <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-md bg-emerald-500 text-white">
                                <CheckCircle size={9} aria-hidden />
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="ds-text-label text-theme-primary truncate">{acct.display_name || acct.username || acct.platform_user_id}</p>
                              {acct.isPrimary && <Badge className="bg-primary/10 text-primary">{t('socialPage.badgePrimary')}</Badge>}
                              {acct.isActive && !acct.isPrimary && <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">{t('socialPage.badgeActive')}</Badge>}
                            </div>
                            <p className="ds-text-caption truncate">{t('socialPage.accountIdLabel', { id: String(acct.platform_user_id).slice(0, 14).toUpperCase() })}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {!acct.isActive && (
                              <Button variant="ghost" size="sm" onClick={() => setActive(id, aid)} title={t('socialPage.makeActiveTitle')}>
                                {t('socialPage.useButton')}
                              </Button>
                            )}
                            <IconButton
                              variant="ghost" size="sm"
                              onClick={() => disconnectAccount(id, aid)}
                              disabled={rowBusy}
                              title={t('socialPage.disconnectAccount', { account: acct.username || aid })}
                              aria-label={t('socialPage.disconnectAccount', { account: acct.username || aid })}
                              className="text-rose-500"
                            >
                              {rowBusy ? <RefreshCw size={16} className="animate-spin" aria-hidden /> : <Unlink size={16} aria-hidden />}
                            </IconButton>
                          </div>
                        </div>
                      )
                    })}

                    {/* Add another account on this same platform. The
                        backend now appends to accounts[] instead of
                        overwriting, so this is safe to call when an
                        account already exists. */}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full"
                      onClick={() => connectAccount(id)}
                      disabled={isConnecting}
                      leftIcon={isConnecting ? <RefreshCw size={14} className="animate-spin" aria-hidden /> : <Plus size={14} aria-hidden />}
                    >
                      {isConnecting ? t('socialPage.negotiatingShort') : t('socialPage.addAnotherAccount', { platform: id.toUpperCase() })}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-auto pt-5 border-t border-[var(--border-subtle)] space-y-3">
                    {isTikTok && (
                      <div className="ds-surface-subtle p-3">
                        <p className="ds-text-label text-amber-600 dark:text-amber-400 mb-1">{t('socialPage.pendingApiApproval')}</p>
                        <p className="ds-text-caption">{t('socialPage.tiktokPendingBody')}</p>
                      </div>
                    )}
                    <Button
                      variant={isTikTok ? 'secondary' : 'primary'}
                      size="md"
                      className="w-full"
                      onClick={() => connectAccount(id)}
                      disabled={isConnecting}
                      leftIcon={isConnecting ? <RefreshCw size={16} className="animate-spin" aria-hidden /> : <Link2 size={16} aria-hidden />}
                    >
                      {isConnecting
                        ? t('socialPage.negotiating')
                        : isTikTok ? t('socialPage.preConnectAccount') : t('socialPage.establishUplink')}
                    </Button>
                  </div>
                )}
              </Panel>
            )
          })}
        </div>
      </div>
    </ErrorBoundary>
  )
}
