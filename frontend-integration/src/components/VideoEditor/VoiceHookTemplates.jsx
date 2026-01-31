import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const VoiceHookTemplates = ({ onTemplateSelect, selectedTemplate }) => {
  const { apiRequest } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      const { data } = await apiRequest('/video/voice-hooks/templates');
      if (data.success) {
        setTemplates(data.data.templates);
      }
    } catch (error) {
      console.error('Failed to load voice hook templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template) => {
    onTemplateSelect(template);
  };

  const getCategoryIcon = (categoryId) => {
    const icons = {
      youtube_tutorial: '📚',
      tiktok_viral: '🎵',
      instagram_story: '📱',
      linkedin_professional: '💼',
      product_review: '🛍️'
    };
    return icons[categoryId] || '🎤';
  };

  const getEngagementColor = (score) => {
    if (score >= 85) return '#10B981';
    if (score >= 75) return '#3B82F6';
    if (score >= 65) return '#F59E0B';
    return '#EF4444';
  };

  if (loading) {
    return (
      <div className="voice-hook-templates loading">
        <div className="loading-spinner">Loading templates...</div>
      </div>
    );
  }

  const filteredTemplates = selectedCategory === 'all'
    ? templates
    : templates.filter(template => template.id.includes(selectedCategory.split('_')[0]));

  return (
    <div className="voice-hook-templates">
      <h3>🎯 Voice Hook Templates</h3>
      <p className="templates-description">
        Pre-built voice hook combinations optimized for different content types and platforms
      </p>

      {/* Category Filter */}
      <div className="template-filters">
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
          <option value="all">All Templates</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="instagram">Instagram</option>
          <option value="linkedin">LinkedIn</option>
          <option value="product">Product Reviews</option>
        </select>
      </div>

      {/* Templates Grid */}
      <div className="templates-grid">
        {filteredTemplates.map(template => (
          <div
            key={template.id}
            className={`template-card ${selectedTemplate?.id === template.id ? 'selected' : ''}`}
            onClick={() => applyTemplate(template)}
          >
            <div className="template-header">
              <div className="template-icon">{getCategoryIcon(template.id)}</div>
              <div className="template-info">
                <h4>{template.name}</h4>
                <div
                  className="engagement-score"
                  style={{ backgroundColor: getEngagementColor(template.estimatedEngagement) }}
                >
                  {template.estimatedEngagement}% Engagement
                </div>
              </div>
            </div>

            <p className="template-description">{template.description}</p>

            <div className="template-stats">
              <div className="stat">
                <span className="stat-label">Hooks:</span>
                <span className="stat-value">{template.hooks.length}</span>
              </div>
              <div className="stat">
                <span className="stat-label">Duration:</span>
                <span className="stat-value">{template.targetDuration}</span>
              </div>
            </div>

            <div className="template-hooks-preview">
              <h5>Hook Sequence:</h5>
              <div className="hooks-timeline">
                {template.hooks.map((hook, index) => (
                  <div key={index} className="timeline-hook">
                    <span className="hook-time">{hook.startTime}s</span>
                    <span className="hook-name">
                      {hook.hookId.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button
              className="apply-template-btn"
              onClick={(e) => {
                e.stopPropagation();
                applyTemplate(template);
              }}
            >
              Apply Template
            </button>
          </div>
        ))}
      </div>

      {selectedTemplate && (
        <div className="template-details">
          <h4>Selected: {selectedTemplate.name}</h4>
          <div className="template-summary">
            <p><strong>Description:</strong> {selectedTemplate.description}</p>
            <p><strong>Estimated Engagement:</strong> {selectedTemplate.estimatedEngagement}%</p>
            <p><strong>Target Duration:</strong> {selectedTemplate.targetDuration}</p>
            <p><strong>Hooks Included:</strong> {selectedTemplate.hooks.length}</p>
          </div>

          <div className="template-actions">
            <button
              className="confirm-apply-btn"
              onClick={() => applyTemplate(selectedTemplate)}
            >
              ✅ Confirm & Apply Template
            </button>
            <button
              className="customize-btn"
              onClick={() => {
                // Could open customization modal
                alert('Template customization coming soon!');
              }}
            >
              🎨 Customize Template
            </button>
          </div>
        </div>
      )}

      <div className="template-tips">
        <h4>💡 Template Tips</h4>
        <ul>
          <li><strong>YouTube Tutorials:</strong> Use intro + transitions for long-form educational content</li>
          <li><strong>TikTok Viral:</strong> Short, high-energy hooks for maximum engagement</li>
          <li><strong>Instagram Stories:</strong> Quick hooks that fit 15-second format</li>
          <li><strong>LinkedIn Professional:</strong> Subtle, business-appropriate hooks</li>
          <li><strong>Product Reviews:</strong> Dramatic hooks to build anticipation</li>
        </ul>
      </div>
    </div>
  );
};

export default VoiceHookTemplates;





