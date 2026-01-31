'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPut } from '../../../../lib/api'
// Navbar removed - provided by dashboard layout
import LoadingSkeleton from '../../../../components/LoadingSkeleton'
import ToastContainer from '../../../../components/ToastContainer'
import { useAuth } from '../../../../hooks/useAuth'
import { User, Mail, Camera, Save, Key } from 'lucide-react'

export default function ProfileSettingsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    bio: '',
    website: '',
    location: '',
    social_links: {} as Record<string, string>,
    niche: '',
    profilePicture: null as File | null,
  })
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const profileData = await apiGet('/auth/profile')
      setProfile({
        name: profileData.user.name || '',
        email: profileData.user.email || '',
        bio: profileData.user.bio || '',
        website: profileData.user.website || '',
        location: profileData.user.location || '',
        social_links: profileData.user.social_links || {},
        niche: profileData.user.niche || '',
        profilePicture: null,
      })
    } catch (error) {
      console.error('Failed to load profile:', error)
      // Fallback to user data if API fails
      if (user) {
        setProfile({
          name: user.name || '',
          email: user.email || '',
          bio: (user as any).bio || '',
          website: (user as any).website || '',
          location: (user as any).location || '',
          social_links: (user as any).social_links || {},
          niche: user.niche || '',
          profilePicture: null,
        })
      }
    } finally {
      setLoading(false)
    }
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfile(prev => ({ ...prev, profilePicture: file }))
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const saveProfile = async () => {
    setSaving(true)
    try {
      const updateData = {
        name: profile.name,
        bio: profile.bio,
        website: profile.website,
        location: profile.location,
        social_links: profile.social_links,
        niche: profile.niche,
      }

      await apiPut('/auth/profile', updateData)

      const event = new CustomEvent('toast', {
        detail: { message: 'Profile updated successfully', type: 'success' }
      })
      window.dispatchEvent(event)
    } catch (error: any) {
      console.error('Failed to save profile:', error)
      const event = new CustomEvent('toast', {
        detail: { message: error.response?.data?.error || 'Failed to update profile', type: 'error' }
      })
      window.dispatchEvent(event)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="container mx-auto px-4 py-8">
          <LoadingSkeleton type="card" count={3} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <ToastContainer />
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your profile information</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          {/* Profile Picture */}
          <div>
            <label className="block text-sm font-medium mb-4">Profile Picture</label>
            <div className="flex items-center gap-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center overflow-hidden">
                  {preview ? (
                    <img src={preview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-12 h-12 text-gray-400" />
                  )}
                </div>
                <label className="absolute bottom-0 right-0 p-2 bg-blue-600 text-white rounded-full cursor-pointer hover:bg-blue-700 transition">
                  <Camera className="w-4 h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Upload a profile picture. Recommended size: 400x400px
                </p>
                <button
                  onClick={() => {
                    setPreview(null)
                    setProfile(prev => ({ ...prev, profilePicture: null }))
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Remove picture
                </button>
              </div>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <User className="w-4 h-4" />
              Name
            </label>
            <input
              type="text"
              value={profile.name}
              onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium mb-2">Bio</label>
            <textarea
              value={profile.bio}
              onChange={(e) => setProfile(prev => ({ ...prev, bio: e.target.value }))}
              rows={4}
              placeholder="Tell us about yourself..."
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-500 mt-1">{profile.bio.length}/500 characters</p>
          </div>

          {/* Website */}
          <div>
            <label className="block text-sm font-medium mb-2">Website</label>
            <input
              type="url"
              value={profile.website}
              onChange={(e) => setProfile(prev => ({ ...prev, website: e.target.value }))}
              placeholder="https://example.com"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium mb-2">Location</label>
            <input
              type="text"
              value={profile.location}
              onChange={(e) => setProfile(prev => ({ ...prev, location: e.target.value }))}
              placeholder="City, Country"
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Niche */}
          <div>
            <label className="block text-sm font-medium mb-2">Niche</label>
            <select
              value={profile.niche}
              onChange={(e) => setProfile(prev => ({ ...prev, niche: e.target.value }))}
              className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select your niche</option>
              <option value="health">Health & Fitness</option>
              <option value="finance">Finance & Money</option>
              <option value="education">Education</option>
              <option value="technology">Technology</option>
              <option value="lifestyle">Lifestyle</option>
              <option value="business">Business</option>
              <option value="entertainment">Entertainment</option>
              <option value="other">Other</option>
            </select>
          </div>

          {/* Social Links */}
          <div>
            <label className="block text-sm font-medium mb-2">Social Links</label>
            <div className="space-y-2">
              <input
                type="url"
                value={profile.social_links.twitter || ''}
                onChange={(e) => setProfile(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, twitter: e.target.value }
                }))}
                placeholder="Twitter URL"
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="url"
                value={profile.social_links.linkedin || ''}
                onChange={(e) => setProfile(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, linkedin: e.target.value }
                }))}
                placeholder="LinkedIn URL"
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="url"
                value={profile.social_links.instagram || ''}
                onChange={(e) => setProfile(prev => ({
                  ...prev,
                  social_links: { ...prev.social_links, instagram: e.target.value }
                }))}
                placeholder="Instagram URL"
                className="w-full px-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={saveProfile}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}



