'use client'

import { useState } from 'react'

const API_URL = 'https://click-platform.onrender.com/api'

export default function SimpleRegister() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setMessage('')
    setLoading(true)

    try {
      console.log('Starting registration...')
      setMessage('Registering...')

      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      })

      console.log('Response status:', response.status)
      const data = await response.json()
      console.log('Response data:', data)

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Registration failed')
      }

      const token = data.data?.token || data.token
      if (!token) {
        throw new Error('No token received')
      }

      console.log('Token received, storing...')
      localStorage.setItem('token', token)
      setMessage('✅ Success! Token stored. Redirecting...')

      // Wait a moment then redirect
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 1000)

    } catch (error: any) {
      console.error('Registration error:', error)
      setMessage(`❌ Error: ${error.message}`)
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: '500px', margin: '50px auto', padding: '20px' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Simple Registration Test</h1>
      
      {message && (
        <div style={{
          padding: '10px',
          marginBottom: '20px',
          backgroundColor: message.includes('✅') ? '#d4edda' : '#f8d7da',
          border: `1px solid ${message.includes('✅') ? '#c3e6cb' : '#f5c6cb'}`,
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="simple-name" style={{ display: 'block', marginBottom: '5px' }}>Name:</label>
          <input
            id="simple-name"
            name="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="simple-email" style={{ display: 'block', marginBottom: '5px' }}>Email:</label>
          <input
            id="simple-email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="simple-password" style={{ display: 'block', marginBottom: '5px' }}>Password:</label>
          <input
            id="simple-password"
            name="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', padding: '8px', fontSize: '16px' }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: '16px',
            backgroundColor: loading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>

      <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
        <p><strong>API URL:</strong> {API_URL}</p>
        <p><strong>Check console (F12) for detailed logs</strong></p>
      </div>
    </div>
  )
}

