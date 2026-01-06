'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { apiGet, apiPost, apiPut, apiDelete } from '../../../lib/api'
import { useAuth } from '../../../hooks/useAuth'
import LoadingSpinner from '../../../components/LoadingSpinner'
import ErrorAlert from '../../../components/ErrorAlert'
import { Plus, Edit, Trash2, Calendar, Eye, Clock } from 'lucide-react'

interface Post {
  id: string
  title: string
  content: string
  excerpt: string
  slug: string
  status: 'draft' | 'published' | 'scheduled'
  featured_image?: string
  thumbnail?: string
  tags: string[]
  categories: string[]
  published_at?: string
  scheduled_at?: string
  created_at: string
  updated_at: string
}

interface PostsResponse {
  posts: Post[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export default function PostsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedStatus, setSelectedStatus] = useState<string>('all')

  useEffect(() => {
    loadPosts()
  }, [currentPage, selectedStatus])

  const loadPosts = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '20'
      })

      if (selectedStatus !== 'all') {
        params.append('status', selectedStatus)
      }

      const response = await apiGet<PostsResponse>(`/posts?${params}`)
      setPosts(response.posts)
    } catch (err: any) {
      console.error('Failed to load posts:', err)
      setError(err.message || 'Failed to load posts')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (postId: string, newStatus: string) => {
    try {
      if (newStatus === 'published') {
        await apiPost(`/posts/${postId}/publish`, {})
      } else {
        await apiPut(`/posts/${postId}`, { status: newStatus })
      }
      await loadPosts() // Refresh the list
    } catch (err: any) {
      console.error('Failed to update post status:', err)
      setError(err.message || 'Failed to update post status')
    }
  }

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return

    try {
      await apiDelete(`/posts/${postId}`)
      await loadPosts() // Refresh the list
    } catch (err: any) {
      console.error('Failed to delete post:', err)
      setError(err.message || 'Failed to delete post')
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published': return 'bg-green-100 text-green-800'
      case 'scheduled': return 'bg-blue-100 text-blue-800'
      case 'draft': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading && posts.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
        <span className="ml-2 text-gray-600">Loading posts...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Posts</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage your content and schedule posts</p>
        </div>
        <button
          onClick={() => router.push('/dashboard/posts/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Post
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600"
        >
          <option value="all">All Posts</option>
          <option value="draft">Drafts</option>
          <option value="published">Published</option>
          <option value="scheduled">Scheduled</option>
        </select>
      </div>

      {/* Error Alert */}
      {error && (
        <ErrorAlert message={error} onRetry={loadPosts} />
      )}

      {/* Posts List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
        {posts.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <Edit className="w-12 h-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No posts yet</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Create your first post to get started</p>
            <button
              onClick={() => router.push('/dashboard/posts/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Create Post
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Title
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {posts.map((post) => (
                  <tr key={post.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {post.thumbnail && (
                          <img
                            src={post.thumbnail}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover mr-3"
                          />
                        )}
                        <div>
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {post.title || 'Untitled Post'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {post.excerpt ? post.excerpt.substring(0, 60) + '...' : 'No excerpt'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(post.status)}`}>
                        {post.status}
                      </span>
                      {post.status === 'scheduled' && post.scheduled_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(post.scheduled_at)}
                        </div>
                      )}
                      {post.status === 'published' && post.published_at && (
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {formatDate(post.published_at)}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {formatDate(post.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)}
                          className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        {post.status === 'draft' && (
                          <button
                            onClick={() => handleStatusChange(post.id, 'published')}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Publish now"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        )}
                        {post.status === 'draft' && (
                          <button
                            onClick={() => router.push(`/dashboard/posts/${post.id}/schedule`)}
                            className="text-purple-600 hover:text-purple-900 dark:text-purple-400 dark:hover:text-purple-300"
                            title="Schedule post"
                          >
                            <Calendar className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePost(post.id)}
                          className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {posts.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, posts.length)} of {posts.length} posts
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1">Page {currentPage}</span>
            <button
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={posts.length < 20}
              className="px-3 py-1 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
