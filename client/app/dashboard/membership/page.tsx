'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'
import LoadingSpinner from '../../../components/LoadingSpinner'
import { useAuth } from '../../../hooks/useAuth'
import { useToast } from '../../../contexts/ToastContext'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

interface MembershipPackage {
  _id: string
  name: string
  slug: string
  description: string
  price: {
    monthly: number
    yearly: number
  }
  features: any
  limits: any
}

interface CurrentMembership {
  package: MembershipPackage | null
  subscription: any
  usage: any
  limits: any
}

export default function MembershipPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { showToast } = useToast()
  const [packages, setPackages] = useState<MembershipPackage[]>([])
  const [currentMembership, setCurrentMembership] = useState<CurrentMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const [upgrading, setUpgrading] = useState<string | null>(null)

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }
    loadData()
  }, [user, router])

  const loadData = async () => {
    try {
      const token = localStorage.getItem('token')
      const [packagesRes, membershipRes] = await Promise.all([
        axios.get(`${API_URL}/membership/packages`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_URL}/membership/current`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ])

      if (packagesRes.data.success) {
        setPackages(packagesRes.data.data || [])
      }
      if (membershipRes.data.success) {
        setCurrentMembership(membershipRes.data.data)
      }
    } catch (error: any) {
      showToast('Failed to load membership data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (packageSlug: string) => {
    setUpgrading(packageSlug)
    try {
      const token = localStorage.getItem('token')
      const response = await axios.post(
        `${API_URL}/membership/upgrade`,
        { packageSlug },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      )

      if (response.data.success) {
        showToast('Membership upgraded successfully!', 'success')
        await loadData()
      }
    } catch (error: any) {
      showToast(error.response?.data?.error || 'Failed to upgrade membership', 'error')
    } finally {
      setUpgrading(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading membership..." />
      </div>
    )
  }

  const currentPackageSlug = currentMembership?.package?.slug

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-6">Membership Packages</h1>

        {currentMembership && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Current Membership</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Package</p>
                <p className="text-lg font-semibold">
                  {currentMembership.package?.name || 'No package'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Subscription Status</p>
                <p className={`text-lg font-semibold ${
                  currentMembership.subscription?.status === 'active' ? 'text-green-600' : 'text-yellow-600'
                }`}>
                  {currentMembership.subscription?.status || 'trial'}
                </p>
              </div>
            </div>

            {currentMembership.usage && (
              <div className="mt-6">
                <h3 className="font-semibold mb-2">Usage</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-600">Videos</p>
                    <p className="text-lg">
                      {currentMembership.usage.videosProcessed || 0}
                      {currentMembership.limits?.videosPerMonth !== -1 && 
                        ` / ${currentMembership.limits?.videosPerMonth || 'N/A'}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Content</p>
                    <p className="text-lg">
                      {currentMembership.usage.contentGenerated || 0}
                      {currentMembership.limits?.contentPerMonth !== -1 && 
                        ` / ${currentMembership.limits?.contentPerMonth || 'N/A'}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Scripts</p>
                    <p className="text-lg">
                      {currentMembership.usage.scriptsGenerated || 0}
                      {currentMembership.limits?.scriptsPerMonth !== -1 && 
                        ` / ${currentMembership.limits?.scriptsPerMonth || 'N/A'}`}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600">Music Files</p>
                    <p className="text-lg">
                      {currentMembership.usage.musicFiles || 0}
                      {currentMembership.limits?.musicFiles !== -1 && 
                        ` / ${currentMembership.limits?.musicFiles || 'N/A'}`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {packages.map((pkg) => {
            const isCurrent = currentPackageSlug === pkg.slug
            const isUpgrading = upgrading === pkg.slug

            return (
              <div
                key={pkg._id}
                className={`bg-white rounded-lg shadow-lg p-6 ${
                  isCurrent ? 'ring-2 ring-purple-500' : ''
                }`}
              >
                <div className="text-center mb-4">
                  <h3 className="text-2xl font-bold">{pkg.name}</h3>
                  <p className="text-gray-600 mt-2">{pkg.description}</p>
                  <div className="mt-4">
                    <span className="text-3xl font-bold">${pkg.price.monthly}</span>
                    <span className="text-gray-600">/month</span>
                  </div>
                  {pkg.price.yearly > 0 && (
                    <p className="text-sm text-gray-500 mt-2">
                      ${pkg.price.yearly}/year (save ${(pkg.price.monthly * 12 - pkg.price.yearly).toFixed(0)})
                    </p>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <div>
                    <p className="font-semibold">Videos</p>
                    <p className="text-sm text-gray-600">
                      {pkg.features.videoProcessing.maxVideosPerMonth === -1
                        ? 'Unlimited'
                        : `${pkg.features.videoProcessing.maxVideosPerMonth}/month`}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Content Generation</p>
                    <p className="text-sm text-gray-600">
                      {pkg.features.contentGeneration.maxGenerationsPerMonth === -1
                        ? 'Unlimited'
                        : `${pkg.features.contentGeneration.maxGenerationsPerMonth}/month`}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Scripts</p>
                    <p className="text-sm text-gray-600">
                      {pkg.features.scripts.maxScriptsPerMonth === -1
                        ? 'Unlimited'
                        : `${pkg.features.scripts.maxScriptsPerMonth}/month`}
                    </p>
                  </div>
                  <div>
                    <p className="font-semibold">Storage</p>
                    <p className="text-sm text-gray-600">
                      {(pkg.features.storage.maxStorage / (1024 ** 3)).toFixed(0)} GB
                    </p>
                  </div>
                  {pkg.features.analytics.advancedAnalytics && (
                    <div>
                      <p className="font-semibold text-purple-600">✓ Advanced Analytics</p>
                    </div>
                  )}
                  {pkg.features.analytics.apiAccess && (
                    <div>
                      <p className="font-semibold text-purple-600">✓ API Access</p>
                    </div>
                  )}
                  {pkg.features.support.prioritySupport && (
                    <div>
                      <p className="font-semibold text-purple-600">✓ Priority Support</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => handleUpgrade(pkg.slug)}
                  disabled={isCurrent || isUpgrading}
                  className={`w-full py-2 rounded-lg font-semibold ${
                    isCurrent
                      ? 'bg-gray-300 text-gray-600 cursor-not-allowed'
                      : 'bg-purple-600 text-white hover:bg-purple-700'
                  }`}
                >
                  {isCurrent
                    ? 'Current Plan'
                    : isUpgrading
                    ? 'Upgrading...'
                    : pkg.price.monthly === 0
                    ? 'Get Started'
                    : 'Upgrade'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}







