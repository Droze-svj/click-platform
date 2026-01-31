import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const AnalyticsDashboard = () => {
  const { apiRequest } = useAuth();

  // Mock data fallback
  const mockData = useMemo(() => ({
      overview: {
        totalViews: 45280,
        totalEngagement: 12.5,
        totalRevenue: 1250.75,
        totalVideos: 24
      },
      trends: {
        views: [1200, 1450, 1680, 1920, 2100, 2350, 2680],
        engagement: [8.2, 9.1, 10.5, 11.2, 12.1, 13.5, 12.5],
        revenue: [45.20, 52.80, 68.90, 72.30, 89.40, 95.60, 125.75]
      },
      topVideos: [
        {
          id: 1,
          title: 'Product Demo Tutorial',
          views: 12500,
          engagement: 15.2,
          revenue: 325.50,
          thumbnail: null,
          publishedAt: '2024-01-15',
          platform: 'youtube'
        },
        {
          id: 2,
          title: 'Social Media Short',
          views: 8900,
          engagement: 22.1,
          revenue: 156.80,
          thumbnail: null,
          publishedAt: '2024-01-14',
          platform: 'instagram'
        },
        {
          id: 3,
          title: 'Behind the Scenes',
          views: 7200,
          engagement: 18.7,
          revenue: 98.40,
          thumbnail: null,
          publishedAt: '2024-01-12',
          platform: 'tiktok'
        }
      ],
      platformBreakdown: {
        youtube: { views: 25600, engagement: 12.1, revenue: 680.50 },
        instagram: { views: 12800, engagement: 18.5, revenue: 345.20 },
        tiktok: { views: 6880, engagement: 15.8, revenue: 225.05 }
      },
      audienceInsights: {
        demographics: {
          age: { '18-24': 35, '25-34': 28, '35-44': 22, '45+': 15 },
          gender: { male: 52, female: 48 },
          location: { 'US': 45, 'UK': 15, 'Canada': 12, 'Australia': 8, 'Other': 20 }
        },
        behavior: {
          avgWatchTime: '4:32',
          completionRate: 78.5,
          shareRate: 8.2,
          saveRate: 12.1
        }
      },
      contentPerformance: {
        bestPerforming: {
          hookType: 'attention',
          engagement: 23.5,
          views: 18500
        },
        bestTime: 'Thursday 7PM',
        bestLength: '8-12 minutes',
        topTags: ['tutorial', 'how-to', 'tips', 'review']
      }
    }), []);

  const [timeRange, setTimeRange] = useState('30d'); // 7d, 30d, 90d, 1y
  const [analyticsData, setAnalyticsData] = useState(mockData);
  const [isLoading, setIsLoading] = useState(false);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      setIsLoading(true);
      try {
        const response = await apiRequest(`/analytics/overview?range=${timeRange}`);
        setAnalyticsData(response || mockData);
      } catch (error) {
        console.error('Failed to load analytics:', error);
        // Use mock data as fallback
        setAnalyticsData(mockData);
      } finally {
        setIsLoading(false);
      }
    };

    loadAnalytics();
  }, [timeRange, apiRequest, mockData]);

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatCurrency = (num) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const getPlatformIcon = (platform) => {
    switch (platform) {
      case 'youtube': return '📺';
      case 'instagram': return '📸';
      case 'tiktok': return '🎵';
      case 'twitter': return '🐦';
      default: return '🎬';
    }
  };

  const MetricCard = ({ title, value, change, icon, color }) => (
    <div className="metric-card" style={{ '--card-color': color }}>
      <div className="metric-header">
        <div className="metric-icon">{icon}</div>
        <div className="metric-change" style={{ color: change >= 0 ? 'var(--success)' : 'var(--error)' }}>
          {change >= 0 ? '↗️' : '↘️'} {Math.abs(change)}%
        </div>
      </div>
      <div className="metric-value">{value}</div>
      <div className="metric-title">{title}</div>
    </div>
  );

  const ChartPlaceholder = ({ title, height = '200px' }) => (
    <div className="chart-placeholder" style={{ height }}>
      <div className="chart-icon">📊</div>
      <h5>{title}</h5>
      <p>Interactive charts coming soon</p>
    </div>
  );

  if (!analyticsData || !analyticsData.overview || isLoading) {
    return (
      <div className="analytics-loading">
        <div className="loading-spinner"></div>
        <p>{isLoading ? 'Loading analytics...' : 'Preparing dashboard...'}</p>
      </div>
    );
  }

  return (
    <div className="analytics-dashboard">
      {/* Analytics Header */}
      <div className="analytics-header">
        <div className="header-info">
          <h3>📊 Analytics Dashboard</h3>
          <p>Track performance, engagement, and audience insights</p>
        </div>

        <div className="header-controls">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-range-select"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="Total Views"
          value={formatNumber(analyticsData?.overview?.totalViews || 0)}
          change={12.5}
          icon="👁️"
          color="#3b82f6"
        />
        <MetricCard
          title="Engagement Rate"
          value={`${analyticsData?.overview?.totalEngagement || 0}%`}
          change={8.2}
          icon="📈"
          color="#10b981"
        />
        <MetricCard
          title="Revenue"
          value={formatCurrency(analyticsData?.overview?.totalRevenue || 0)}
          change={15.7}
          icon="💰"
          color="#f59e0b"
        />
        <MetricCard
          title="Videos Published"
          value={analyticsData?.overview?.totalVideos || 0}
          change={5.3}
          icon="🎬"
          color="#ec4899"
        />
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-container">
          <h4>📈 Performance Trends</h4>
          <ChartPlaceholder title="Views, Engagement & Revenue Over Time" height="300px" />
        </div>

        <div className="chart-container">
          <h4>🎯 Platform Breakdown</h4>
          <div className="platform-breakdown">
            {Object.entries(analyticsData?.platformBreakdown || {}).map(([platform, data]) => (
              <div key={platform} className="platform-card">
                <div className="platform-header">
                  <span className="platform-icon">{getPlatformIcon(platform)}</span>
                  <span className="platform-name">{platform.charAt(0).toUpperCase() + platform.slice(1)}</span>
                </div>
                <div className="platform-metrics">
                  <div className="metric">
                    <span className="value">{formatNumber(data.views)}</span>
                    <span className="label">Views</span>
                  </div>
                  <div className="metric">
                    <span className="value">{data.engagement}%</span>
                    <span className="label">Engagement</span>
                  </div>
                  <div className="metric">
                    <span className="value">{formatCurrency(data.revenue)}</span>
                    <span className="label">Revenue</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Analysis */}
      <div className="content-analysis">
        <div className="analysis-section">
          <h4>🏆 Top Performing Videos</h4>
          <div className="top-videos">
            {(analyticsData?.topVideos || []).map((video, index) => (
              <div key={video.id} className="top-video-card">
                <div className="video-rank">#{index + 1}</div>
                <div className="video-thumbnail-small">
                  <div className="thumbnail-placeholder-small">
                    {getPlatformIcon(video.platform)}
                  </div>
                </div>
                <div className="video-details">
                  <h5>{video.title}</h5>
                  <div className="video-stats">
                    <span>👁️ {formatNumber(video.views)}</span>
                    <span>📈 {video.engagement}%</span>
                    <span>💰 {formatCurrency(video.revenue)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="analysis-section">
          <h4>👥 Audience Insights</h4>
          <div className="audience-grid">
            <div className="insight-card">
              <h5>📊 Demographics</h5>
              <div className="demographic-data">
                <div className="demo-section">
                  <h6>Age Groups</h6>
                  {Object.entries(analyticsData?.audienceInsights?.demographics?.age || {}).map(([age, percent]) => (
                    <div key={age} className="demo-bar">
                      <span>{age}</span>
                      <div className="bar" style={{ width: `${percent}%` }}></div>
                      <span>{percent}%</span>
                    </div>
                  ))}
                </div>
                <div className="demo-section">
                  <h6>Top Locations</h6>
                  {Object.entries(analyticsData?.audienceInsights?.demographics?.location || {}).slice(0, 3).map(([location, percent]) => (
                    <div key={location} className="location-item">
                      <span>{location}</span>
                      <span>{percent}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="insight-card">
              <h5>🎬 Viewing Behavior</h5>
              <div className="behavior-metrics">
                <div className="behavior-item">
                  <span className="icon">⏱️</span>
                  <div>
                    <div className="value">{analyticsData?.audienceInsights?.behavior?.avgWatchTime || '0:00'}</div>
                    <div className="label">Avg Watch Time</div>
                  </div>
                </div>
                <div className="behavior-item">
                  <span className="icon">✅</span>
                  <div>
                    <div className="value">{analyticsData?.audienceInsights?.behavior?.completionRate || 0}%</div>
                    <div className="label">Completion Rate</div>
                  </div>
                </div>
                <div className="behavior-item">
                  <span className="icon">📤</span>
                  <div>
                    <div className="value">{analyticsData?.audienceInsights?.behavior?.shareRate || 0}%</div>
                    <div className="label">Share Rate</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="analysis-section">
          <h4>🎯 Content Optimization</h4>
          <div className="optimization-grid">
            <div className="optimization-card">
              <h5>🔥 Best Hook Type</h5>
              <div className="optimization-value">
                {analyticsData?.contentPerformance?.bestPerforming?.hookType || 'attention'}
              </div>
              <div className="optimization-metric">
                {analyticsData?.contentPerformance?.bestPerforming?.engagement || 0}% engagement
              </div>
            </div>

            <div className="optimization-card">
              <h5>🕐 Best Posting Time</h5>
              <div className="optimization-value">
                {analyticsData?.contentPerformance?.bestTime || 'TBD'}
              </div>
              <div className="optimization-metric">
                Highest engagement window
              </div>
            </div>

            <div className="optimization-card">
              <h5>📏 Optimal Length</h5>
              <div className="optimization-value">
                {analyticsData?.contentPerformance?.bestLength || 'TBD'}
              </div>
              <div className="optimization-metric">
                Maximum retention
              </div>
            </div>

            <div className="optimization-card">
              <h5>🏷️ Top Tags</h5>
              <div className="tag-cloud">
                {(analyticsData?.contentPerformance?.topTags || []).map(tag => (
                  <span key={tag} className="tag">{tag}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalyticsDashboard;
