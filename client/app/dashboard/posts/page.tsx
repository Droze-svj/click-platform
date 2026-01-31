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

      // Skip API calls in development mode
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 [Posts] Skipping posts API call in development mode')

        // Provide comprehensive mock data for development
        const mockPosts: Post[] = [
          {
            id: 'mock-post-1',
            title: '10 Tips for Viral Content Creation',
            content: 'Learn the secrets of creating content that goes viral...',
            excerpt: 'Discover the strategies behind viral content creation that every creator should know.',
            slug: '10-tips-viral-content-creation',
            status: 'published',
            featured_image: '/api/placeholder/400/250',
            thumbnail: '/api/placeholder/200/150',
            tags: ['content-creation', 'viral', 'tips'],
            categories: ['Strategy', 'Tutorials'],
            published_at: new Date(Date.now() - 86400000).toISOString(),
            created_at: new Date(Date.now() - 86400000).toISOString(),
            updated_at: new Date(Date.now() - 86400000).toISOString()
          },
          {
            id: 'mock-post-2',
            title: 'Behind the Scenes: Content Strategy',
            content: 'A deep dive into our content strategy process...',
            excerpt: 'Get an exclusive look at how we plan and execute our content strategy.',
            slug: 'behind-scenes-content-strategy',
            status: 'published',
            featured_image: '/api/placeholder/400/250',
            thumbnail: '/api/placeholder/200/150',
            tags: ['strategy', 'behind-scenes', 'planning'],
            categories: ['Strategy', 'Case Studies'],
            published_at: new Date(Date.now() - 172800000).toISOString(),
            created_at: new Date(Date.now() - 172800000).toISOString(),
            updated_at: new Date(Date.now() - 172800000).toISOString()
          },
          {
            id: 'mock-post-3',
            title: 'Quick Tips for Better Engagement',
            content: 'Simple but effective tips to boost engagement...',
            excerpt: 'Learn quick and easy ways to increase engagement on your social media posts.',
            slug: 'quick-tips-better-engagement',
            status: 'draft',
            featured_image: '/api/placeholder/400/250',
            thumbnail: '/api/placeholder/200/150',
            tags: ['engagement', 'tips', 'social-media'],
            categories: ['Tips', 'Social Media'],
            scheduled_at: new Date(Date.now() + 86400000).toISOString(),
            created_at: new Date(Date.now() - 259200000).toISOString(),
            updated_at: new Date(Date.now() - 259200000).toISOString()
          },
          {
            id: 'mock-post-4',
            title: 'Video Editing Masterclass',
            content: 'Complete guide to professional video editing...',
            excerpt: 'Master the art of video editing with our comprehensive guide and techniques.',
            slug: 'video-editing-masterclass',
            status: 'scheduled',
            featured_image: '/api/placeholder/400/250',
            thumbnail: '/api/placeholder/200/150',
            tags: ['video-editing', 'tutorial', 'masterclass'],
            categories: ['Video', 'Tutorials'],
            scheduled_at: new Date(Date.now() + 172800000).toISOString(),
            created_at: new Date(Date.now() - 345600000).toISOString(),
            updated_at: new Date(Date.now() - 345600000).toISOString()
          }
        ]

        // Filter by status and paginate
        const filteredPosts = selectedStatus === 'all'
          ? mockPosts
          : mockPosts.filter(post => post.status === selectedStatus)

        const startIndex = (currentPage - 1) * 20
        const endIndex = startIndex + 20
        const paginatedPosts = filteredPosts.slice(startIndex, endIndex)

        setPosts(paginatedPosts)
        setLoading(false)
        return
      }

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
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-blue-500 rounded-full flex items-center justify-center">
                <Edit className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-indigo-600 to-blue-600 bg-clip-text text-transparent">
                  Content Management
                </h1>
                <p className="text-gray-600 mt-1">Create, manage, and schedule your posts</p>
              </div>
            </div>
            <button
              onClick={() => router.push('/dashboard/posts/create')}
              className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Plus className="w-5 h-5" />
              Create New Post
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-lg font-semibold text-gray-800">Filter Posts:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:border-indigo-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all duration-200"
              >
                <option value="all">📝 All Posts ({posts.length})</option>
                <option value="draft">📄 Drafts</option>
                <option value="published">✅ Published</option>
                <option value="scheduled">📅 Scheduled</option>
              </select>
            </div>
            <div className="text-sm text-gray-600">
              Showing {posts.length} posts
            </div>
          </div>
        </div>

      {/* Error Alert */}
      {error && (
        <ErrorAlert message={error} onClose={() => setError(null)} />
      )}

        {/* Posts List */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
          {posts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-indigo-100 to-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Edit className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-2xl font-semibold text-gray-800 mb-3">No posts yet</h3>
              <p className="text-gray-600 mb-6 max-w-md mx-auto">Start creating amazing content by publishing your first post</p>
              <button
                onClick={() => router.push('/dashboard/posts/create')}
                className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-blue-500 hover:from-indigo-600 hover:to-blue-600 text-white rounded-xl inline-flex items-center gap-2 font-medium shadow-lg hover:shadow-xl transition-all duration-200"
              >
                <Plus className="w-5 h-5" />
                Create Your First Post
              </button>
            </div>
        ) : (
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((post) => (
                <div key={post.id} className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden">
                  {/* Post Thumbnail */}
                  {post.thumbnail && (
                    <div className="h-32 bg-gradient-to-r from-gray-200 to-gray-300 relative overflow-hidden">
                      <img
                        src={post.thumbnail}
                        alt={post.title || 'Post thumbnail'}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute top-3 right-3">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full text-white ${
                          post.status === 'published' ? 'bg-green-500' :
                          post.status === 'scheduled' ? 'bg-blue-500' :
                          'bg-gray-500'
                        }`}>
                          {post.status}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Post Content */}
                  <div className="p-5">
                    <h3 className="font-semibold text-lg text-gray-800 mb-2 line-clamp-2">
                      {post.title || 'Untitled Post'}
                    </h3>

                    {post.excerpt && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}

                    {/* Status and Date Info */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {post.status === 'published' && post.published_at && (
                          <>
                            <Eye className="w-4 h-4 text-green-500" />
                            <span className="text-xs text-gray-500">
                              {new Date(post.published_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {post.status === 'scheduled' && post.scheduled_at && (
                          <>
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-xs text-gray-500">
                              {new Date(post.scheduled_at).toLocaleDateString()}
                            </span>
                          </>
                        )}
                        {post.status === 'draft' && (
                          <span className="text-xs text-gray-500">
                            Draft • {new Date(post.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Categories/Tags */}
                    {post.categories && post.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-4">
                        {post.categories.slice(0, 2).map((category, index) => (
                          <span
                            key={index}
                            className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full"
                          >
                            {category}
                          </span>
                        ))}
                        {post.categories.length > 2 && (
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-full">
                            +{post.categories.length - 2}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => router.push(`/dashboard/posts/${post.id}/edit`)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Edit post"
                        >
                          <Edit className="w-4 h-4" />
                        </button>

                        {post.status === 'draft' && (
                          <>
                            <button
                              onClick={() => handleStatusChange(post.id, 'published')}
                              className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                              title="Publish now"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/posts/${post.id}/schedule`)}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                              title="Schedule post"
                            >
                              <Calendar className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>

                      <button
                        onClick={() => handleDeletePost(post.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete post"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
    </div>
  )
}
