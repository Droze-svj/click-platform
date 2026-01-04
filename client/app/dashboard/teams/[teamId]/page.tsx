'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import LoadingSpinner from '../../../../components/LoadingSpinner'
import { useAuth } from '../../../../hooks/useAuth'
import { useToast } from '../../../../contexts/ToastContext'
import { apiGet } from '../../../../lib/api'

interface TeamMember {
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
}

interface Team {
  _id: string
  name: string
  description: string
  ownerId: {
    _id: string
    name: string
    email: string
  }
  members: TeamMember[]
  settings: {
    allowMemberInvites: boolean
    requireApproval: boolean
  }
  createdAt: string
}

export default function TeamDetailsPage() {
  const router = useRouter()
  const params = useParams()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)

  const teamId = params.teamId as string

  useEffect(() => {
    if (teamId) {
      loadTeam()
    }
  }, [teamId])

  const loadTeam = async () => {
    try {
      const response = await apiGet(`/teams/${teamId}`)
      setTeam(response)
    } catch (error) {
      console.error('Failed to load team:', error)
      showToast('Failed to load team details', 'error')
      router.push('/dashboard/teams')
    } finally {
      setLoading(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner': return 'bg-red-100 text-red-800'
      case 'admin': return 'bg-blue-100 text-blue-800'
      case 'editor': return 'bg-green-100 text-green-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Team Not Found</h2>
          <p className="text-gray-600 mb-4">The team you're looking for doesn't exist or you don't have access to it.</p>
          <button
            onClick={() => router.push('/dashboard/teams')}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            Back to Teams
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/teams')}
          className="text-blue-600 hover:text-blue-800 mb-4 inline-flex items-center"
        >
          ← Back to Teams
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{team.name}</h1>
          <p className="text-gray-600 mt-2">{team.description}</p>
          <div className="mt-4 flex items-center space-x-4">
            <span className="text-sm text-gray-500">
              Owner: {team.ownerId.name} ({team.ownerId.email})
            </span>
            <span className="text-sm text-gray-500">
              {team.members.length} member{team.members.length !== 1 ? 's' : ''}
            </span>
            <span className="text-sm text-gray-500">
              Created {new Date(team.createdAt).toLocaleDateString()}
            </span>
          </div>
        </div>
      </div>

      {/* Team Members */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Team Members</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {team.members.map((member) => (
            <div key={member.userId._id} className="px-6 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {member.userId.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-900">{member.userId.name}</h3>
                  <p className="text-sm text-gray-500">{member.userId.email}</p>
                  <p className="text-xs text-gray-400">
                    Joined {new Date(member.joinedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(member.role)}`}>
                  {member.role}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Settings */}
      <div className="mt-8 bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Team Settings</h2>
        </div>
        <div className="px-6 py-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Allow Member Invites</h3>
                <p className="text-sm text-gray-500">Allow team members to invite others to join</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                team.settings.allowMemberInvites ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {team.settings.allowMemberInvites ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-900">Require Approval</h3>
                <p className="text-sm text-gray-500">Require approval for new content submissions</p>
              </div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                team.settings.requireApproval ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {team.settings.requireApproval ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
