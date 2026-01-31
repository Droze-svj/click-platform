import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const VoiceHookMarketplace = ({ onHookPurchase }) => {
  const { apiRequest } = useAuth();
  const [marketplace, setMarketplace] = useState({ hooks: [], categories: [], priceTiers: [] });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: '',
    rating: 0,
    price: '',
    search: ''
  });
  const [playingHook, setPlayingHook] = useState(null);
  const [sortBy, setSortBy] = useState('downloads');

  useEffect(() => {
    loadMarketplace();
  }, [filters]);

  const loadMarketplace = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });

      const { data } = await apiRequest(`/video/voice-hooks/marketplace?${queryParams}`);
      if (data.success) {
        setMarketplace(data.data);
      }
    } catch (error) {
      console.error('Failed to load marketplace:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (filterKey, value) => {
    setFilters(prev => ({
      ...prev,
      [filterKey]: value
    }));
  };

  const purchaseHook = async (hook) => {
    if (hook.price === 'premium') {
      // Handle premium purchase
      alert(`Premium hook "${hook.name}" - Purchase flow would open here`);
      return;
    }

    // Free hook - download directly
    try {
      const { data } = await apiRequest(`/video/voice-hooks/preview/${hook.id}`);
      if (data.success) {
        onHookPurchase({
          ...hook,
          audioUrl: data.data.url,
          purchased: true
        });
        alert(`Successfully downloaded "${hook.name}"!`);
      }
    } catch (error) {
      console.error('Failed to download hook:', error);
      alert('Failed to download voice hook');
    }
  };

  const playPreview = async (hook) => {
    if (playingHook === hook.id) {
      setPlayingHook(null);
      // Stop audio
      return;
    }

    try {
      const { data } = await apiRequest(`/video/voice-hooks/preview/${hook.id}`);
      if (data.success) {
        setPlayingHook(hook.id);
        // In a real implementation, you'd play the audio here
        setTimeout(() => setPlayingHook(null), 30000); // Auto-stop after 30s
      }
    } catch (error) {
      console.error('Failed to play preview:', error);
    }
  };

  const sortedHooks = [...marketplace.hooks].sort((a, b) => {
    switch (sortBy) {
      case 'rating':
        return b.rating - a.rating;
      case 'downloads':
        return b.downloads - a.downloads;
      case 'name':
        return a.name.localeCompare(b.name);
      default:
        return b.downloads - a.downloads;
    }
  });

  const renderStars = (rating) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;

    for (let i = 0; i < fullStars; i++) {
      stars.push('⭐');
    }
    if (hasHalfStar) stars.push('⭐');
    while (stars.length < 5) stars.push('☆');

    return stars.join('');
  };

  if (loading) {
    return (
      <div className="voice-hook-marketplace loading">
        <div className="loading-spinner">Loading marketplace...</div>
      </div>
    );
  }

  return (
    <div className="voice-hook-marketplace">
      <h3>🛍️ Voice Hook Marketplace</h3>
      <p className="marketplace-description">
        Discover community-created voice hooks and premium options
      </p>

      {/* Filters and Search */}
      <div className="marketplace-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search voice hooks..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
          />
        </div>

        <div className="filters-row">
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
          >
            <option value="">All Categories</option>
            {marketplace.categories.map(category => (
              <option key={category} value={category}>
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </option>
            ))}
          </select>

          <select
            value={filters.price}
            onChange={(e) => handleFilterChange('price', e.target.value)}
          >
            <option value="">All Prices</option>
            {marketplace.priceTiers.map(tier => (
              <option key={tier} value={tier}>
                {tier.charAt(0).toUpperCase() + tier.slice(1)}
              </option>
            ))}
          </select>

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
            <option value="downloads">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Marketplace Stats */}
      <div className="marketplace-stats">
        <div className="stat">
          <span className="stat-number">{marketplace.hooks.length}</span>
          <span className="stat-label">Voice Hooks</span>
        </div>
        <div className="stat">
          <span className="stat-number">
            {marketplace.hooks.filter(h => h.price === 'free').length}
          </span>
          <span className="stat-label">Free Hooks</span>
        </div>
        <div className="stat">
          <span className="stat-number">
            {marketplace.hooks.filter(h => h.price === 'premium').length}
          </span>
          <span className="stat-label">Premium Hooks</span>
        </div>
      </div>

      {/* Hooks Grid */}
      <div className="marketplace-grid">
        {sortedHooks.map(hook => (
          <div key={hook.id} className="marketplace-card">
            <div className="card-header">
              <img
                src={hook.thumbnail || '/default-hook-thumbnail.png'}
                alt={hook.name}
                className="hook-thumbnail"
              />
              <button
                className={`preview-btn ${playingHook === hook.id ? 'playing' : ''}`}
                onClick={() => playPreview(hook)}
              >
                {playingHook === hook.id ? '⏸️' : '▶️'}
              </button>
            </div>

            <div className="card-content">
              <h4>{hook.name}</h4>
              <p className="hook-description">{hook.description}</p>

              <div className="hook-meta">
                <div className="rating">
                  {renderStars(hook.rating)}
                  <span className="rating-score">({hook.rating})</span>
                </div>
                <div className="downloads">
                  📥 {hook.downloads.toLocaleString()} downloads
                </div>
                <div className="creator">
                  👤 {hook.creator}
                </div>
              </div>

              <div className="hook-tags">
                {hook.tags.map(tag => (
                  <span key={tag} className="tag">#{tag}</span>
                ))}
              </div>

              <div className="card-actions">
                <div className={`price-tag ${hook.price}`}>
                  {hook.price === 'free' ? '🆓 FREE' : '💎 PREMIUM'}
                </div>
                <button
                  className="purchase-btn"
                  onClick={() => purchaseHook(hook)}
                >
                  {hook.price === 'free' ? 'Download' : 'Purchase'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {marketplace.hooks.length === 0 && (
        <div className="no-results">
          <h4>No voice hooks found</h4>
          <p>Try adjusting your search filters</p>
        </div>
      )}

      {/* Marketplace Tips */}
      <div className="marketplace-tips">
        <h4>🎯 Marketplace Tips</h4>
        <div className="tips-grid">
          <div className="tip">
            <h5>⭐ Highly Rated</h5>
            <p>Hooks with 4.5+ stars have proven engagement boosts</p>
          </div>
          <div className="tip">
            <h5>📥 Popular Downloads</h5>
            <p>Most downloaded hooks work well across platforms</p>
          </div>
          <div className="tip">
            <h5>🏷️ Tags Matter</h5>
            <p>Use tags to find hooks for specific content types</p>
          </div>
          <div className="tip">
            <h5>💎 Premium Quality</h5>
            <p>Premium hooks include custom recordings and variations</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceHookMarketplace;





