'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Share2,
  Trash2,
  ChevronDown,
  Users,
  Shield,
} from 'lucide-react'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../../lib/api'
import { extractApiData, extractApiError } from '../../../../utils/apiResponse'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'

interface TeamMember {
  userId: { _id: string; name: string; email: string }
  role: string
  joinedAt: string
  permissions: {
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canShare: boolean
    canApprove: boolean
  }
}

interface Team {
  _id: string
  name: string
  description: string
  ownerId: { _id: string; name: string; email: string }
  members: TeamMember[]
  settings: { allowMemberInvites: boolean; requireApproval: boolean }
  createdAt: string
}

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

export default function TeamDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [inviting, setInviting] = useState(false)
  const [updatingRole, setUpdatingRole] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)

  const teamId = params.teamId as string

  const loadTeam = useCallback(async () => {
    try {
      const res = await apiGet(`/teams/${teamId}`)
      const data = extractApiData<Team>(res as any) ?? (res as any)?.data
      setTeam(data || null)
    } catch {
      showToast('Failed to load team', 'error')
      router.push('/dashboard/teams')
    } finally {
      setLoading(false)
    }
  }, [teamId, router, showToast])

  useEffect(() => {
    if (teamId) loadTeam()
  }, [teamId, loadTeam])

  const canManage = team && (() => {
    const uid = (user as any)?.id || (user as any)?._id
    const m = team.members.find((x) => (x.userId as any)?._id === uid)
    return m?.role === 'owner' || m?.role === 'admin'
  })()

  const isOwner = (m: TeamMember) => m.role === 'owner'
  const ownerId = (t: Team) => (t.ownerId as any)?._id

  const handleInviteByEmail = async () => {
    const email = inviteEmail.trim()
    if (!email) {
      showToast('Enter an email address', 'error')
      return
    }
    setInviting(true)
    try {
      await apiPost(`/teams/${teamId}/invite-by-email`, { email, role: inviteRole })
      showToast('Invite sent', 'success')
      setInviteEmail('')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Invite failed', 'error')
    } finally {
      setInviting(false)
    }
  }

  const handleUpdateRole = async (memberId: string, role: string) => {
    setUpdatingRole(memberId)
    try {
      await apiPut(`/teams/${teamId}/members/${memberId}/role`, { role })
      showToast('Role updated', 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Update failed', 'error')
    } finally {
      setUpdatingRole(null)
    }
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm('Remove this member from the team?')) return
    setRemoving(memberId)
    try {
      await apiDelete(`/teams/${teamId}/members/${memberId}`)
      showToast('Member removed', 'success')
      await loadTeam()
    } catch (e: any) {
      const err = extractApiError(e)
      showToast(err?.message || 'Remove failed', 'error')
    } finally {
      setRemoving(null)
    }
  }

  const getRoleBadge = (role: string) => {
    const c: Record<string, string> = {
      owner: 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200',
      admin: 'bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200',
      editor: 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200',
      viewer: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    }
    return c[role] || c.viewer
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center px-4">
          <h2 className="text-2xl font-bold mb-2">Team not found</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            You don't have access or it doesn't exist.
          </p>
          <button
            onClick={() => router.push('/dashboard/teams')}
            className="bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700"
          >
            Back to Teams
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.push('/dashboard/teams')}
          className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Teams
        </button>

        <div className="mb-8">
          <h1 className="text-3xl font-bold">{team.name}</h1>
          {team.description && (
            <p className="text-gray-600 dark:text-gray-400 mt-1">{team.description}</p>
          )}
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-gray-500 dark:text-gray-400">
            <span>Owner: {team.ownerId?.name} ({team.ownerId?.email})</span>
            <span>{team.members.length} member{team.members.length !== 1 ? 's' : ''}</span>
            <span>Created {new Date(team.createdAt).toLocaleDateString()}</span>
          </div>
        </div>

        {/* Invite by email */}
        {canManage && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 mb-6">
            <h2 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <UserPlus className="w-5 h-5" />
              Invite by email
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              They must already have a Click account.
            </p>
            <div className="flex flex-wrap gap-2">
              <div className="flex-1 min-w-[200px] flex gap-2">
                <div className="relative flex-1">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@example.com"
                    className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                  />
                </div>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleInviteByEmail}
                  disabled={inviting}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {inviting ? 'Inviting...' : 'Invite'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Members */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Users className="w-5 h-5" />
            <h2 className="text-lg font-semibold">Members</h2>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {team.members.map((m) => (
              <div
                key={(m.userId as any)?._id}
                className="px-6 py-4 flex flex-wrap items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-sm font-medium">
                    {(m.userId?.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{m.userId?.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{m.userId?.email}</p>
                    <p className="text-xs text-gray-400">
                      Joined {new Date(m.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isOwner(m) ? (
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${getRoleBadge(m.role)}`}
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Owner
                    </span>
                  ) : canManage ? (
                    <>
                      <select
                        value={m.role}
                        onChange={(e) => handleUpdateRole((m.userId as any)._id, e.target.value)}
                        disabled={!!updatingRole}
                        className="px-3 py-1.5 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm"
                      >
                        {ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleRemoveMember((m.userId as any)._id)}
                        disabled={!!removing}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <span
                      className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getRoleBadge(m.role)}`}
                    >
                      {m.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share content */}
        <div className="mt-6">
          <a
            href="/dashboard/content"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
          >
            <Share2 className="w-4 h-4" />
            Share content with this team
          </a>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Go to Content, select an item, and share it with this team.
          </p>
        </div>

        {/* Settings */}
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">Team settings</h2>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Allow member invites</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Members can invite others
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  team.settings?.allowMemberInvites
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {team.settings?.allowMemberInvites ? 'On' : 'Off'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Require approval</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  New content needs approval
                </p>
              </div>
              <span
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  team.settings?.requireApproval
                    ? 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                }`}
              >
                {team.settings?.requireApproval ? 'On' : 'Off'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
