'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

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
    userId: {
      _id: string
      name: string
      email: string
    }
    role: string
    joinedAt: string
    permissions: {
      canCreate: boolean
      canEdit: boolean
      canDelete: boolean
      canShare: boolean
      canApprove: boolean
    }
  }>
  settings: {
    allowMemberInvites: boolean
    requireApproval: boolean
  }
}

export default function TeamsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadTeams()
  }, [user, router])

  const loadTeams = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/teams`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      if (response.data.success) {
        setTeams(response.data.data || [])
      }
    } catch (error) {
      showToast('Failed to load teams', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      showToast('Team name is required', 'error')
      return
    }

    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/teams`,
        {
          name: newTeamName,
          description: newTeamDescription
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        showToast('Team created successfully', 'success')
        setShowCreateModal(false)
        setNewTeamName('')
        setNewTeamDescription('')
        await loadTeams()
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to create team', 'error')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading teams..." />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Teams</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
          >
            + Create Team
          </button>
        </div>

        {teams.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-600 mb-4">No teams yet. Create your first team to collaborate!</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Create Team
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {teams.map((team) => (
              <div key={team._id} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{team.name}</h3>
                    {team.description && (
                      <p className="text-sm text-gray-600 mt-1">{team.description}</p>
                    )}
                  </div>
                  {team.ownerId._id === user?.id && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                      Owner
                    </span>
                  )}
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    {team.members.length} member{team.members.length !== 1 ? 's' : ''}
                  </p>
                  <div className="space-y-2">
                    {team.members.slice(0, 3).map((member, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{member.userId.name}</span>
                        <span className="px-2 py-1 bg-gray-100 rounded text-xs capitalize">
                          {member.role}
                        </span>
                      </div>
                    ))}
                    {team.members.length > 3 && (
                      <p className="text-xs text-gray-500">
                        +{team.members.length - 3} more members
                      </p>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => router.push(`/dashboard/teams/${team._id}`)}
                  className="w-full bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 text-sm"
                >
                  View Team
                </button>
              </div>
            ))}
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
              <h2 className="text-xl font-semibold mb-4">Create Team</h2>
              
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Team Name *</label>
                <input
                  type="text"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  placeholder="Enter team name..."
                  autoFocus
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  className="w-full px-4 py-2 border rounded-lg"
                  rows={3}
                  placeholder="Describe your team..."
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateModal(false)
                    setNewTeamName('')
                    setNewTeamDescription('')
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateTeam}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}







