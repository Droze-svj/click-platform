'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, ChevronRight } from 'lucide-react'
import { apiGet, apiPost } from '../../../lib/api'
import { extractApiData } from '../../../utils/apiResponse'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

interface Team {
  _id: string
  name: string
  description: string
  ownerId: {
    _id: string
    name: string
    email: string
  }
  members: Array<{
    userId: { _id: string; name: string; email: string }
    role: string
    joinedAt: string
  }>
}

export default function TeamsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const loadTeams = useCallback(async () => {
    try {
      const res = await apiGet('/teams')
      const data = extractApiData<Team[]>(res as any) ?? (res as any)?.data
      setTeams(Array.isArray(data) ? data : [])
    } catch {
      showToast('Failed to load teams', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadTeams()
  }, [user, router, loadTeams])

  const handleCreate = async () => {
    if (!name.trim()) {
      showToast('Team name is required', 'error')
      return
    }
    setCreating(true)
    try {
      await apiPost('/teams', { name: name.trim(), description: description.trim() })
      showToast('Team created', 'success')
      setShowCreateModal(false)
      setName('')
      setDescription('')
      await loadTeams()
    } catch (e: any) {
      showToast(e?.response?.data?.error || 'Failed to create team', 'error')
    } finally {
      setCreating(false)
    }
  }

  const isOwner = (t: Team) =>
    (t.ownerId as any)?._id === (user as any)?.id || (t.ownerId as any)?._id === (user as any)?._id

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading teams..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Teams</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Collaborate with your team and share content
            </p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-5 py-2.5 rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Create Team
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Create a team to invite members, share content, and run workflows together.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700"
            >
              <Plus className="w-5 h-5" />
              Create Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div
                key={team._id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 hover:border-purple-300 dark:hover:border-purple-700 transition-colors"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{team.name}</h3>
                    {team.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                        {team.description}
                      </p>
                    )}
                  </div>
                  {isOwner(team) && (
                    <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded text-xs font-medium">
                      Owner
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                  {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                </p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {team.members.slice(0, 3).map((m, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
                    >
                      <span className="w-7 h-7 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-xs font-medium">
                        {(m.userId?.name || '?').charAt(0).toUpperCase()}
                      </span>
                      <span className="capitalize">{m.role}</span>
                    </div>
                  ))}
                  {team.members.length > 3 && (
                    <span className="text-xs text-gray-500">
                      +{team.members.length - 3} more
                    </span>
                  )}
                </div>
                <button
                  onClick={() => router.push(`/dashboard/teams/${team._id}`)}
                  className="w-full inline-flex items-center justify-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg hover:bg-purple-700 text-sm"
                >
                  View team
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold">Create Team</h2>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Team name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    placeholder="e.g. Content Team"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-4 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700"
                    rows={3}
                    placeholder="What's this team for?"
                  />
                </div>
              </div>
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setName('')
                    setDescription('')
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="px-5 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
