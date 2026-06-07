'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiPost } from '../../../../lib/api'
import { useAuth } from '../../../../hooks/useAuth'
import ErrorAlert from '../../../../components/ErrorAlert'
import {
  Save, X, Plus,
  Twitter, Linkedin, Instagram, Facebook, Video, Youtube,
  type LucideIcon,
} from 'lucide-react'
import { useTranslation } from '@/hooks/useTranslation'
import { cn } from '../../../../lib/utils'
import {
  Panel,
  Button,
  IconButton,
  Badge,
  FormField,
  Input,
  Textarea,
  SectionHeader,
} from '../../../../components/ui'

const PLATFORMS: { id: string; name: string; icon: LucideIcon }[] = [
  { id: 'twitter', name: 'Twitter', icon: Twitter },
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin },
  { id: 'instagram', name: 'Instagram', icon: Instagram },
  { id: 'facebook', name: 'Facebook', icon: Facebook },
  { id: 'tiktok', name: 'TikTok', icon: Video },
  { id: 'youtube', name: 'YouTube', icon: Youtube },
]

export default function CreatePostPage() {
  const router = useRouter()
  const { user } = useAuth()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    excerpt: '',
    status: 'draft',
    featured_image: '',
    thumbnail: '',
    tags: [] as string[],
    categories: [] as string[],
    scheduled_at: '',
    platforms: [] as string[]
  })

  const [tagInput, setTagInput] = useState('')
  const [categoryInput, setCategoryInput] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Guard against double-fire: the header button + form Enter key can both
    // hit this handler, and async create-post bursts will dupe the row.
    if (loading) return

    if (!formData.title.trim()) {
      setError(t('postsCreatePage.errorTitleRequired'))
      return
    }

    if (!formData.content.trim()) {
      setError(t('postsCreatePage.errorContentRequired'))
      return
    }

    setLoading(true)
    setError(null)

    try {
      const postData = {
        ...formData,
        title: formData.title.trim(),
        content: formData.content.trim(),
        excerpt: formData.excerpt.trim(),
        scheduled_at: formData.scheduled_at || null
      }

      await apiPost('/posts', postData)

      router.push('/dashboard/posts?success=created')
    } catch (err: any) {
      console.error('Failed to create post:', err)
      setError(err.response?.data?.error || err.message || t('postsCreatePage.errorCreateFailed'))
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()]
      }))
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tg => tg !== tag)
    }))
  }

  const addCategory = () => {
    if (categoryInput.trim() && !formData.categories.includes(categoryInput.trim())) {
      setFormData(prev => ({
        ...prev,
        categories: [...prev.categories, categoryInput.trim()]
      }))
      setCategoryInput('')
    }
  }

  const removeCategory = (category: string) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.filter(c => c !== category)
    }))
  }

  const togglePlatform = (platform: string) => {
    setFormData(prev => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter(p => p !== platform)
        : [...prev.platforms, platform]
    }))
  }

  return (
    <div className="ds-bg-mesh-soft min-h-screen px-4 sm:px-6 lg:px-10 py-8 pb-24 max-w-4xl mx-auto overflow-x-hidden text-theme-primary">
      {/* Header (global DashboardHeader provides the breadcrumb) */}
      <SectionHeader
        as="h1"
        title={t('postsCreatePage.title')}
        description={t('postsCreatePage.subtitle')}
        className="mb-6"
        actions={
          <>
            <Button variant="ghost" size="md" onClick={() => router.push('/dashboard/posts')}>
              {t('postsCreatePage.cancel')}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleSubmit}
              loading={loading}
              leftIcon={!loading ? <Save size={16} aria-hidden /> : undefined}
            >
              {loading ? t('postsCreatePage.creating') : t('postsCreatePage.createButton')}
            </Button>
          </>
        }
      />

      {error && <div className="mb-6"><ErrorAlert message={error} /></div>}

      <form onSubmit={handleSubmit} className="space-y-6">
        <Panel variant="glass" className="space-y-6">
          <FormField label={t('postsCreatePage.titleLabel')} htmlFor="post-title">
            <Input
              id="post-title"
              type="text"
              aria-label={t('postsCreatePage.titleAria')}
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder={t('postsCreatePage.titlePlaceholder')}
              required
            />
          </FormField>

          <FormField
            label={t('postsCreatePage.contentLabel')}
            htmlFor="post-content"
            hint={t('postsCreatePage.charCount', { count: formData.content.length })}
          >
            <Textarea
              id="post-content"
              aria-label={t('postsCreatePage.contentAria')}
              value={formData.content}
              onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
              rows={12}
              placeholder={t('postsCreatePage.contentPlaceholder')}
              required
            />
          </FormField>

          <FormField
            label={t('postsCreatePage.excerptLabel')}
            htmlFor="post-excerpt"
            hint={t('postsCreatePage.excerptCharCount', { count: formData.excerpt.length })}
          >
            <Textarea
              id="post-excerpt"
              aria-label={t('postsCreatePage.excerptAria')}
              value={formData.excerpt}
              onChange={(e) => setFormData(prev => ({ ...prev, excerpt: e.target.value }))}
              rows={3}
              placeholder={t('postsCreatePage.excerptPlaceholder')}
            />
          </FormField>
        </Panel>

        <Panel variant="glass" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField label={t('postsCreatePage.featuredImageLabel')} htmlFor="post-featured">
            <Input
              id="post-featured"
              type="url"
              aria-label={t('postsCreatePage.featuredImageLabel')}
              value={formData.featured_image}
              onChange={(e) => setFormData(prev => ({ ...prev, featured_image: e.target.value }))}
              placeholder="https://example.com/image.jpg"
            />
          </FormField>
          <FormField label={t('postsCreatePage.thumbnailLabel')} htmlFor="post-thumbnail">
            <Input
              id="post-thumbnail"
              type="url"
              aria-label={t('postsCreatePage.thumbnailLabel')}
              value={formData.thumbnail}
              onChange={(e) => setFormData(prev => ({ ...prev, thumbnail: e.target.value }))}
              placeholder="https://example.com/thumbnail.jpg"
            />
          </FormField>
        </Panel>

        <Panel variant="glass" className="space-y-6">
          {/* Tags */}
          <FormField label={t('postsCreatePage.tagsLabel')} htmlFor="post-tag-input">
            <div className="flex gap-2">
              <Input
                id="post-tag-input"
                type="text"
                aria-label={t('postsCreatePage.addTag')}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag() } }}
                placeholder={t('postsCreatePage.addTag')}
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="md" onClick={addTag} leftIcon={<Plus size={16} aria-hidden />}>
                {t('postsCreatePage.add')}
              </Button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.tags.map((tag) => (
                  <Badge key={tag} className="bg-primary/10 text-primary gap-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={t('postsCreatePage.removeTag', { tag })}
                      title={t('postsCreatePage.removeTag', { tag })}
                      className="ml-0.5 inline-flex hover:text-rose-500"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </FormField>

          {/* Categories */}
          <FormField label={t('postsCreatePage.categoriesLabel')} htmlFor="post-cat-input">
            <div className="flex gap-2">
              <Input
                id="post-cat-input"
                type="text"
                aria-label={t('postsCreatePage.addCategory')}
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCategory() } }}
                placeholder={t('postsCreatePage.addCategory')}
                className="flex-1"
              />
              <Button type="button" variant="secondary" size="md" onClick={addCategory} leftIcon={<Plus size={16} aria-hidden />}>
                {t('postsCreatePage.add')}
              </Button>
            </div>
            {formData.categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-3">
                {formData.categories.map((category) => (
                  <Badge key={category} className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1">
                    {category}
                    <button
                      type="button"
                      onClick={() => removeCategory(category)}
                      aria-label={t('postsCreatePage.removeCategory', { category })}
                      title={t('postsCreatePage.removeCategory', { category })}
                      className="ml-0.5 inline-flex hover:text-rose-500"
                    >
                      <X size={12} aria-hidden />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </FormField>

          {/* Platforms */}
          <FormField label={t('postsCreatePage.targetPlatforms')}>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {PLATFORMS.map((platform) => {
                const selected = formData.platforms.includes(platform.id)
                const PIcon = platform.icon
                return (
                  <button
                    type="button"
                    key={platform.id}
                    onClick={() => togglePlatform(platform.id)}
                    aria-pressed={selected ? 'true' : 'false'}
                    aria-label={selected ? t('postsCreatePage.platformSelected', { platform: platform.name }) : t('postsCreatePage.platformSelect', { platform: platform.name })}
                    title={selected ? t('postsCreatePage.platformSelected', { platform: platform.name }) : t('postsCreatePage.platformSelect', { platform: platform.name })}
                    className={cn(
                      'flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors',
                      selected
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-input hover:bg-accent hover:text-accent-foreground text-theme-secondary'
                    )}
                  >
                    <PIcon size={16} aria-hidden />
                    <span className="ds-text-label">{platform.name}</span>
                  </button>
                )
              })}
            </div>
          </FormField>
        </Panel>

        <Panel variant="subtle" className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <FormField
            label={t('postsCreatePage.scheduleLabel')}
            htmlFor="post-schedule"
            hint={t('postsCreatePage.scheduleHint')}
          >
            <Input
              id="post-schedule"
              type="datetime-local"
              aria-label={t('postsCreatePage.scheduleAria')}
              value={formData.scheduled_at}
              onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
            />
          </FormField>

          <FormField label={t('postsCreatePage.statusLabel')} htmlFor="post-status">
            <select
              id="post-status"
              aria-label={t('postsCreatePage.statusAria')}
              value={formData.status}
              onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="draft">{t('postsCreatePage.statusDraft')}</option>
              <option value="published">{t('postsCreatePage.statusPublishNow')}</option>
              <option value="scheduled">{t('postsCreatePage.statusScheduleLater')}</option>
            </select>
          </FormField>
        </Panel>
      </form>
    </div>
  )
}
