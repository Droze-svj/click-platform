const mongoose = require('mongoose');

// Long-form posts written in Dashboard → Posts (drafts, scheduled, published).
// MongoDB home of what used to live only in the Supabase `posts` table, which
// production doesn't have — so the Posts page could never save anything.
const blogPostSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 300 },
  content: { type: String, default: '', maxlength: 200000 },
  excerpt: { type: String, default: '', maxlength: 2000 },
  slug: { type: String, default: '' },
  status: { type: String, enum: ['draft', 'scheduled', 'published', 'archived'], default: 'draft' },
  featuredImage: String,
  thumbnail: String,
  tags: { type: [String], default: [] },
  categories: { type: [String], default: [] },
  platforms: { type: [String], default: [] },
  scheduledAt: Date,
  publishedAt: Date,
}, { timestamps: true });

blogPostSchema.index({ userId: 1, createdAt: -1 });
blogPostSchema.index({ userId: 1, status: 1, scheduledAt: 1 });

/** The snake_case shape the Posts pages read (same as the Supabase rows). */
blogPostSchema.methods.toApi = function toApi() {
  return {
    id: String(this._id),
    title: this.title,
    content: this.content,
    excerpt: this.excerpt,
    slug: this.slug,
    status: this.status,
    featured_image: this.featuredImage || null,
    thumbnail: this.thumbnail || null,
    tags: this.tags || [],
    categories: this.categories || [],
    platforms: this.platforms || [],
    published_at: this.publishedAt || null,
    scheduled_at: this.scheduledAt || null,
    created_at: this.createdAt,
    updated_at: this.updatedAt,
    author_id: String(this.userId),
  };
};

module.exports = mongoose.models.BlogPost || mongoose.model('BlogPost', blogPostSchema);
