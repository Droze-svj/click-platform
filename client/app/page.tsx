'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://click-platform.onrender.com/api'

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setLoading(false)
        return
      }

      const response = await axios.get(`${API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 60000 // 60 seconds for Render.com free tier
      })

      if (response.data.user) {
        setIsAuthenticated(true)
        router.push('/dashboard')
      }
    } catch (error: any) {
      // Don't remove token on network errors - might be server waking up
      if (error.response?.status === 401 || error.response?.status === 403) {
        localStorage.removeItem('token')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center text-white">
          <h1 className="text-6xl font-bold mb-4">Click</h1>
          <p className="text-2xl mb-8">Transform long-form content into social-ready formats</p>
          
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => router.push('/login')}
              className="bg-white text-purple-600 px-8 py-3 rounded-lg font-semibold hover:bg-gray-100 transition"
            >
              Login
            </button>
            <button
              onClick={() => router.push('/register')}
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:bg-white hover:text-purple-600 transition"
            >
              Sign Up
            </button>
          </div>
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            title="Auto Video Clipper"
            description="Cut long videos into viral short-form clips with captions"
          />
          <FeatureCard
            title="Content Generator"
            description="Transform articles into social media posts instantly"
          />
          <FeatureCard
            title="Quote Cards"
            description="Auto-generate branded graphics from memorable quotes"
          />
          <FeatureCard
            title="Content Scheduler"
            description="Schedule posts across 10+ platforms from one dashboard"
          />
          <FeatureCard
            title="Performance AI"
            description="Get weekly insights on your best-performing content"
          />
          <FeatureCard
            title="Niche Packs"
            description="Personalized templates and styles for your niche"
          />
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 text-white">
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-200">{description}</p>
    </div>
  )
}

