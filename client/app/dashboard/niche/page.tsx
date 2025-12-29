'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import SuccessAlert from '../../../components/SuccessAlert'
import { ErrorBoundary } from '../../../components/ErrorBoundary'
import { extractApiData, extractApiError } from '../../../utils/apiResponse'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

const niches = [
  'health', 'finance', 'education', 'technology',
  'lifestyle', 'business', 'entertainment', 'other'
]

export default function NichePage() {
  const router = useRouter()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [userNiche, setUserNiche] = useState('other')
  const [nichePacks, setNichePacks] = useState<any>(null)
  const [brandSettings, setBrandSettings] = useState({
    primaryColor: '#8b5cf6',
    secondaryColor: '#ffffff',
    logo: '',
    font: 'Arial'
  })

  useEffect(() => {
    checkAuth()
    loadData()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        router.push('/login')
        return
      }
      await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (error) {
      localStorage.removeItem('token')
      router.push('/login')
    }
  }

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      
      const [nicheRes, packRes] = await Promise.all([
        axios.get(`${API_URL}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/niche/packs`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      setUserNiche(nicheRes.data.user.niche || 'other')
      setBrandSettings(nicheRes.data.user.brandSettings || brandSettings)
      setNichePacks(packRes.data)
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const handleNicheChange = async (niche: string) => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/niche/select`,
        { niche },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      setUserNiche(niche)
      setSuccess('Niche updated successfully!')
      showToast('Niche updated successfully!', 'success')
    } catch (error: any) {
      const errorMessage = extractApiError(error) || 'Failed to update niche'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleBrandUpdate = async () => {
    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const token = localStorage.getItem('token')
      await axios.put(
        `${API_URL}/niche/brand`,
        brandSettings,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      setSuccess('Brand settings updated successfully!')
      showToast('Brand settings updated successfully!', 'success')
    } catch (error: any) {
      const errorMessage = extractApiError(error) || 'Failed to update brand settings'
      setError(errorMessage)
      showToast(errorMessage, 'error')
    } finally {
      setSaving(false)
    }
  }

  const currentPack = nichePacks?.[userNiche]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">Niche Packs & Branding</h1>
          <p className="text-sm md:text-base text-gray-600">Customize your niche and brand settings</p>
        </div>

        {error && (
          <div className="mb-4">
            <ErrorAlert message={error} onClose={() => setError('')} />
          </div>
        )}

        {success && (
          <div className="mb-4">
            <SuccessAlert message={success} onClose={() => setSuccess('')} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-8">
          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Select Your Niche</h2>
            <div className="grid grid-cols-2 gap-2 md:gap-3 mb-4">
              {niches.map((niche) => (
                <button
                  key={niche}
                  onClick={() => handleNicheChange(niche)}
                  disabled={saving}
                  className={`px-3 md:px-4 py-2 md:py-3 rounded-lg font-medium transition touch-target ${
                    userNiche === niche
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  } disabled:opacity-50`}
                >
                  {niche.charAt(0).toUpperCase() + niche.slice(1)}
                </button>
              ))}
            </div>

            {currentPack && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">{currentPack.name}</h3>
                <p className="text-sm text-gray-600 mb-3">{currentPack.description}</p>
                <div>
                  <p className="text-sm font-medium mb-2">Available Templates:</p>
                  <div className="space-y-1">
                    {currentPack.templates?.map((template: any, index: number) => (
                      <div key={index} className="text-sm text-gray-600">
                        • {template.name}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow p-4 md:p-6">
            <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Brand Settings</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Primary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brandSettings.primaryColor}
                    onChange={(e) => setBrandSettings({ ...brandSettings, primaryColor: e.target.value })}
                    className="w-16 h-10 rounded border"
                  />
                  <input
                    type="text"
                    value={brandSettings.primaryColor}
                    onChange={(e) => setBrandSettings({ ...brandSettings, primaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Secondary Color
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={brandSettings.secondaryColor}
                    onChange={(e) => setBrandSettings({ ...brandSettings, secondaryColor: e.target.value })}
                    className="w-16 h-10 rounded border"
                  />
                  <input
                    type="text"
                    value={brandSettings.secondaryColor}
                    onChange={(e) => setBrandSettings({ ...brandSettings, secondaryColor: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Font
                </label>
                <select
                  value={brandSettings.font}
                  onChange={(e) => setBrandSettings({ ...brandSettings, font: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="Arial">Arial</option>
                  <option value="Helvetica">Helvetica</option>
                  <option value="Times New Roman">Times New Roman</option>
                  <option value="Georgia">Georgia</option>
                  <option value="Verdana">Verdana</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Logo URL (optional)
                </label>
                <input
                  type="url"
                  value={brandSettings.logo}
                  onChange={(e) => setBrandSettings({ ...brandSettings, logo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="https://..."
                />
              </div>

              <button
                onClick={handleBrandUpdate}
                disabled={saving}
                className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50 touch-target"
              >
                {saving ? 'Saving...' : 'Save Brand Settings'}
              </button>
            </div>

            {currentPack && (
              <div className="mt-6 p-4 border-2 rounded-lg" style={{ borderColor: brandSettings.primaryColor }}>
                <h3 className="font-semibold mb-2">Preview</h3>
                <div
                  className="p-4 rounded text-center"
                  style={{
                    background: `linear-gradient(135deg, ${brandSettings.primaryColor}, ${brandSettings.secondaryColor})`,
                    color: '#fff',
                    fontFamily: brandSettings.font
                  }}
                >
                  <p className="text-lg font-bold">Sample Quote</p>
                  <p className="text-sm mt-2">This is how your quote cards will look</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </ErrorBoundary>
  )
}







