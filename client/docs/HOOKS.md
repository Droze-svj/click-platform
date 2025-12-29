# React Hooks Guide

This document describes the custom React hooks available in the application and how to use them.

## Overview

The application provides several custom React hooks for common functionality:

- **Authentication**: `useAuth` - User authentication state and methods
- **API Calls**: `useApi` - API request handling with loading and error states
- **Toast Notifications**: `useToast` - Toast notification management
- **Socket.io**: `useSocket` - Real-time WebSocket connections
- **Translation**: `useTranslation` - Internationalization
- **Error Handling**: `useErrorHandler` - Error handling utilities
- **Form Management**: `useFormAutoSave`, `useDebounce` - Form utilities
- **UI Utilities**: `usePagination`, `useInfiniteScroll`, `useKeyboardShortcuts` - UI helpers

## Authentication Hooks

### `useAuth`

Provides authentication state and user information.

```tsx
import { useAuth } from '../hooks/useAuth'

function MyComponent() {
  const { user, loading, isAuthenticated, login, logout } = useAuth()

  if (loading) return <div>Loading...</div>
  if (!isAuthenticated) return <div>Please log in</div>

  return <div>Welcome, {user?.name}!</div>
}
```

**Returns:**
- `user` - Current user object or null
- `loading` - Loading state
- `isAuthenticated` - Boolean indicating if user is authenticated
- `login(token)` - Login function
- `logout()` - Logout function

## API Hooks

### `useApi`

Provides API request functionality with built-in loading and error states.

```tsx
import { useApi } from '../hooks/useApi'

function MyComponent() {
  const { request, loading, error, setError } = useApi()

  const loadData = async () => {
    const data = await request('get', '/api/users')
    if (data) {
      console.log('Users:', data)
    }
  }

  return (
    <div>
      {loading && <div>Loading...</div>}
      {error && <div>Error: {error}</div>}
      <button onClick={loadData}>Load Users</button>
    </div>
  )
}
```

**Returns:**
- `request(method, endpoint, data, options)` - Make API request
- `loading` - Loading state
- `error` - Error message or null
- `setError(error)` - Manually set error state

## Toast Notifications

### `useToast`

Provides toast notification functionality.

```tsx
import { useToast } from '../contexts/ToastContext'

function MyComponent() {
  const { showToast } = useToast()

  const handleSave = async () => {
    try {
      await saveData()
      showToast('Data saved successfully!', 'success')
    } catch (error) {
      showToast('Failed to save data', 'error')
    }
  }

  return <button onClick={handleSave}>Save</button>
}
```

**Returns:**
- `showToast(message, type, duration?)` - Show toast notification
  - `type`: 'success' | 'error' | 'warning' | 'info'
  - `duration`: Optional duration in milliseconds (default: 5000)

## Real-time Communication

### `useSocket`

Provides Socket.io WebSocket connection for real-time updates.

```tsx
import { useSocket } from '../hooks/useSocket'

function MyComponent() {
  const { socket, connected, on, off } = useSocket()

  useEffect(() => {
    if (!connected) return

    const handleUpdate = (data: any) => {
      console.log('Received update:', data)
    }

    on('processing:complete', handleUpdate)

    return () => {
      off('processing:complete', handleUpdate)
    }
  }, [connected, on, off])

  return <div>Connection: {connected ? 'Connected' : 'Disconnected'}</div>
}
```

**Returns:**
- `socket` - Socket.io instance
- `connected` - Connection status
- `on(event, handler)` - Subscribe to event
- `off(event, handler)` - Unsubscribe from event

## Internationalization

### `useTranslation`

Provides translation functionality for multiple languages.

```tsx
import { useTranslation } from '../hooks/useTranslation'

function MyComponent() {
  const { t, language, setLanguage, availableLanguages } = useTranslation()

  return (
    <div>
      <h1>{t('welcome')}</h1>
      <select value={language} onChange={(e) => setLanguage(e.target.value)}>
        {availableLanguages.map(lang => (
          <option key={lang.code} value={lang.code}>{lang.name}</option>
        ))}
      </select>
    </div>
  )
}
```

**Returns:**
- `t(key)` - Translate function
- `language` - Current language code
- `setLanguage(code)` - Change language
- `availableLanguages` - Array of available languages

## Error Handling

### `useErrorHandler`

Provides error handling utilities for components.

```tsx
import { useErrorHandler } from '../hooks/useErrorHandler'

function MyComponent() {
  const { handleError, handleAsyncError } = useErrorHandler()

  const riskyOperation = () => {
    try {
      // Risky code
    } catch (error) {
      handleError(error, 'Operation failed')
    }
  }

  const asyncOperation = async () => {
    await handleAsyncError(async () => {
      // Async operation
    }, 'Failed to complete operation')
  }

  return <button onClick={riskyOperation}>Execute</button>
}
```

**Returns:**
- `handleError(error, message?)` - Handle synchronous errors
- `handleAsyncError(fn, message?)` - Handle asynchronous errors

## Form Utilities

### `useFormAutoSave`

Automatically saves form data to localStorage.

```tsx
import { useFormAutoSave } from '../hooks/useFormAutoSave'

function MyForm() {
  const { formData, updateField, clearSavedData } = useFormAutoSave('my-form-key')

  return (
    <form>
      <input
        value={formData.title || ''}
        onChange={(e) => updateField('title', e.target.value)}
      />
      <button onClick={clearSavedData}>Clear Saved</button>
    </form>
  )
}
```

**Returns:**
- `formData` - Saved form data object
- `updateField(key, value)` - Update form field
- `clearSavedData()` - Clear saved form data

### `useDebounce`

Debounces a value to reduce updates.

```tsx
import { useDebounce } from '../hooks/useDebounce'
import { useState } from 'react'

function SearchComponent() {
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 500)

  useEffect(() => {
    if (debouncedSearchTerm) {
      performSearch(debouncedSearchTerm)
    }
  }, [debouncedSearchTerm])

  return (
    <input
      value={searchTerm}
      onChange={(e) => setSearchTerm(e.target.value)}
      placeholder="Search..."
    />
  )
}
```

**Returns:**
- Debounced value (updates after delay)

## UI Utilities

### `usePagination`

Manages pagination state and calculations.

```tsx
import { usePagination } from '../hooks/usePagination'

function PaginatedList() {
  const { currentPage, totalPages, goToPage, nextPage, prevPage } = usePagination({
    totalItems: 100,
    itemsPerPage: 10,
  })

  return (
    <div>
      <button onClick={prevPage} disabled={currentPage === 1}>Previous</button>
      <span>Page {currentPage} of {totalPages}</span>
      <button onClick={nextPage} disabled={currentPage === totalPages}>Next</button>
    </div>
  )
}
```

**Returns:**
- `currentPage` - Current page number
- `totalPages` - Total number of pages
- `goToPage(page)` - Navigate to specific page
- `nextPage()` - Go to next page
- `prevPage()` - Go to previous page

### `useInfiniteScroll`

Handles infinite scroll functionality.

```tsx
import { useInfiniteScroll } from '../hooks/useInfiniteScroll'

function InfiniteList() {
  const [items, setItems] = useState([])
  const { loadMore, hasMore, loading } = useInfiniteScroll({
    fetchMore: async () => {
      const newItems = await fetchNextPage()
      setItems(prev => [...prev, ...newItems])
    },
  })

  return (
    <div>
      {items.map(item => <div key={item.id}>{item.name}</div>)}
      {hasMore && <button onClick={loadMore}>Load More</button>}
      {loading && <div>Loading...</div>}
    </div>
  )
}
```

**Returns:**
- `loadMore()` - Load more items
- `hasMore` - Whether more items are available
- `loading` - Loading state

### `useKeyboardShortcuts`

Manages keyboard shortcuts.

```tsx
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

function MyComponent() {
  useKeyboardShortcuts({
    'ctrl+s': (e) => {
      e.preventDefault()
      handleSave()
    },
    'escape': () => {
      handleCancel()
    },
  })

  return <div>Press Ctrl+S to save</div>
}
```

**Returns:**
- No return value (handles shortcuts internally)

## Best Practices

### 1. Use Hooks at Component Top Level

Always use hooks at the top level of your component:

```tsx
// ✅ Good
function MyComponent() {
  const { user } = useAuth()
  const { showToast } = useToast()
  // ... rest of component
}

// ❌ Bad
function MyComponent() {
  if (condition) {
    const { user } = useAuth() // Don't do this
  }
}
```

### 2. Handle Loading States

Always handle loading states when using hooks that fetch data:

```tsx
function MyComponent() {
  const { user, loading } = useAuth()

  if (loading) return <LoadingSpinner />
  if (!user) return <LoginPrompt />

  return <Dashboard />
}
```

### 3. Clean Up Event Listeners

Clean up event listeners in useEffect:

```tsx
useEffect(() => {
  const handleUpdate = (data: any) => {
    // Handle update
  }

  on('update', handleUpdate)

  return () => {
    off('update', handleUpdate)
  }
}, [on, off])
```

### 4. Use Error Handling

Always handle errors when using API hooks:

```tsx
const { request, error, loading } = useApi()

useEffect(() => {
  if (error) {
    showToast(error, 'error')
  }
}, [error])
```

### 5. Optimize with useCallback

For hooks that accept callbacks, use useCallback to prevent unnecessary re-renders:

```tsx
const handleSave = useCallback(async () => {
  await request('post', '/api/save', data)
}, [request, data])
```

## Integration Examples

### Combining Multiple Hooks

```tsx
function ComplexComponent() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const { request, loading } = useApi()
  const { socket, connected } = useSocket()

  const handleAction = async () => {
    try {
      const result = await request('post', '/api/action', { userId: user?.id })
      showToast('Action completed!', 'success')
      socket.emit('action:complete', result)
    } catch (error) {
      showToast('Action failed', 'error')
    }
  }

  return (
    <div>
      <button onClick={handleAction} disabled={!connected || loading}>
        Perform Action
      </button>
    </div>
  )
}
```

## Testing Hooks

When testing components that use hooks:

```tsx
import { renderHook, act } from '@testing-library/react'
import { useApi } from '../hooks/useApi'

test('useApi handles requests correctly', async () => {
  const { result } = renderHook(() => useApi())

  act(() => {
    result.current.request('get', '/api/test')
  })

  expect(result.current.loading).toBe(true)
})
```

## Resources

- [React Hooks Documentation](https://react.dev/reference/react)
- [Custom Hooks Guide](https://react.dev/learn/reusing-logic-with-custom-hooks)



