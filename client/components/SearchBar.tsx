'use client'

import { useState, useEffect, useRef } from 'react'
import { useDebounce } from '../hooks/useDebounce'
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api'

interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  type?: 'content' | 'scripts'
}

export default function SearchBar({ onSearch, placeholder = 'Search...', type = 'content' }: SearchBarProps) {
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<Array<{ id: string; text: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const debouncedQuery = useDebounce(query, 300)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      loadSuggestions(debouncedQuery)
    } else {
      setSuggestions([])
    }
  }, [debouncedQuery, type])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const loadSuggestions = async (searchTerm: string) => {
    try {
      const token = localStorage.getItem('token')
      const response = await axios.get(`${API_URL}/search/suggestions?q=${encodeURIComponent(searchTerm)}&type=${type}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (response.data.success) {
        setSuggestions(response.data.data || [])
        setShowSuggestions(true)
      }
    } catch (error) {
      console.error('Failed to load suggestions', error)
    }
  }

  const handleSearch = (searchQuery: string = query) => {
    onSearch(searchQuery)
    setShowSuggestions(false)
  }

  const handleSuggestionClick = (suggestion: { id: string; text: string }) => {
    setQuery(suggestion.text)
    handleSearch(suggestion.text)
  }

  return (
    <div className="relative w-full" ref={inputRef}>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleSearch()
            }
          }}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder={placeholder}
          className="w-full px-4 py-2 pl-10 border rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        />
        <svg
          className="absolute left-3 top-2.5 w-5 h-5 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {query && (
          <button
            onClick={() => {
              setQuery('')
              onSearch('')
            }}
            className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>

      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.id}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-4 py-2 text-left hover:bg-gray-100"
            >
              {suggestion.text}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}







