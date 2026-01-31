import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const VideoEditorDashboard = () => {
  const { apiRequest } = useAuth();
  const navigate = useNavigate();
  const [uploadedVideos, setUploadedVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [editingMode, setEditingMode] = useState('auto');
  const [isUploading, setIsUploading] = useState(false);
  const [folders, setFolders] = useState({
    recent: [],
    projects: [],
    archive: [],
    expired: []
  });
  const [selectedFolder, setSelectedFolder] = useState('recent');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [selectedVideos, setSelectedVideos] = useState([]);
  const [analyzingVideo, setAnalyzingVideo] = useState(null);
  const [extractingClips, setExtractingClips] = useState(null);
  const [videoClips, setVideoClips] = useState({});
  const [selectedClip, setSelectedClip] = useState(null);

  // History management for undo/redo
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const saveToHistory = useCallback((action) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({
      action,
      timestamp: new Date().toISOString(),
      uploadedVideos: [...uploadedVideos],
      videoClips: { ...videoClips }
    });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex, uploadedVideos, videoClips]);

  const fileInputRef = useRef(null);

  // Update folder counts when videos change
  useEffect(() => {
    const newFolders = {
      recent: [],
      projects: [],
      archive: [],
      expired: []
    };

    uploadedVideos.forEach(video => {
      if (newFolders[video.folder]) {
        newFolders[video.folder].push(video.id);
      }
    });

    setFolders(newFolders);
  }, [uploadedVideos]);

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files);
    const videoFiles = files.filter(file => file.type.startsWith('video/'));

    if (videoFiles.length === 0) {
      alert('Please select video files only.');
      return;
    }

    setIsUploading(true);

    try {
      const uploadedPromises = videoFiles.map(async (file) => {
        const uploadResult = await new Promise(resolve => {
          setTimeout(() => {
            resolve({
              id: Date.now() + Math.random(),
              url: URL.createObjectURL(file)
            });
          }, 1000);
        });

        return {
          id: uploadResult.id,
          name: file.name,
          size: file.size,
          type: file.type,
          url: uploadResult.url,
          file: file, // Store the file object
          status: 'uploaded',
          uploadDate: new Date().toISOString(),
          folder: 'recent'
        };
      });

      const uploaded = await Promise.all(uploadedPromises);
      setUploadedVideos(prev => [...prev, ...uploaded]);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const analyzeVideo = async (videoId) => {
    const video = uploadedVideos.find(v => v.id === videoId);
    if (!video) return;

    setAnalyzingVideo(videoId);

    // Update video status
    setUploadedVideos(prev => prev.map(v =>
      v.id === videoId ? { ...v, status: 'analyzing' } : v
    ));

    try {
      // Try API call first
      let analysisResult;
      try {
        const response = await apiRequest('/video/analyze', {
          method: 'POST',
          body: JSON.stringify({
            videoId: video.id,
            url: video.url,
            duration: video.duration
          })
        });
        if (response && response.success !== false) {
          analysisResult = response;
        }
      } catch (apiError) {
        console.warn('Video analysis API not available, using fallback:', apiError);
      }

      // Generate mock AI analysis for demonstration
      const mockAnalysis = {
        contentType: ['educational', 'tutorial', 'entertainment', 'lifestyle'][Math.floor(Math.random() * 4)],
        mood: ['professional', 'casual', 'energetic', 'calm'][Math.floor(Math.random() * 4)],
        viralPotential: {
          score: Math.floor(Math.random() * 40) + 60,
          pattern: 'high engagement'
        },
        suggestedEdits: [
          {
            type: 'hook',
            start: 0,
            end: 15,
            reason: 'Strong opening hook to capture attention',
            confidence: 0.95
          },
          {
            type: 'music',
            genre: 'upbeat',
            reason: 'Energetic music to maintain engagement',
            confidence: 0.85
          },
          {
            type: 'text',
            content: 'Learn something amazing!',
            position: 'center',
            time: 2,
            reason: 'Clear value proposition'
          }
        ],
        voiceHookSuggestions: [
          {
            id: 'hook1',
            text: 'What if I told you...',
            engagement: 85,
            strategicPlacement: 'opening'
          },
          {
            id: 'hook2',
            text: 'You won\'t believe this...',
            engagement: 82,
            strategicPlacement: 'key-moment'
          }
        ]
      };

      const analysis = analysisResult || mockAnalysis;

      setUploadedVideos(prev => prev.map(v =>
        v.id === videoId ? { ...v, status: 'analyzed', analysis } : v
      ));

      setSelectedVideo({ ...video, analysis });

      alert(`✅ AI Analysis Complete!\n\nContent Type: ${analysis.contentType || 'Unknown'}\nMood: ${analysis.mood || 'Unknown'}\nViral Score: ${analysis.viralPotential?.score || 'N/A'}/100\n\nSmart editing suggestions are now available.`);

    } catch (error) {
      console.error('Analysis failed:', error);
      const fallbackAnalysis = {
        contentType: 'general',
        mood: 'neutral',
        suggestedEdits: [
          { type: 'text', content: 'Add a compelling title', position: 'center', time: 2 }
        ],
        voiceHookSuggestions: [
          { id: 'basic_hook', text: 'Check this out...', engagement: 75 }
        ]
      };

      setUploadedVideos(prev => prev.map(v =>
        v.id === videoId ? { ...v, status: 'analyzed', analysis: fallbackAnalysis } : v
      ));
    } finally {
      setAnalyzingVideo(null);
    }
  };

  const applyEdit = useCallback(async (editType, params) => {
    if (!selectedVideo) return;

    try {
      // Simulate edit operation
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Update video status
      setUploadedVideos(prev => prev.map(v =>
        v.id === selectedVideo.id ? { ...v, status: 'edited' } : v
      ));

      alert(`${editType} applied successfully!`);

    } catch (error) {
      console.error('Edit failed:', error);
      alert('Edit operation failed. Please try again.');
    }
  }, [selectedVideo]);

  const extractHighlights = useCallback(async (videoId) => {
    const video = uploadedVideos.find(v => v.id === videoId);
    if (!video || video.duration < 60) {
      alert('Video must be at least 1 minute long for highlight extraction.');
      return;
    }

    setExtractingClips(videoId);

    try {
      // AI-powered highlight extraction
      const response = await apiRequest('/video/extract-highlights', {
        method: 'POST',
        body: JSON.stringify({
          videoId: video.id,
          url: video.url,
          duration: video.duration,
          title: video.name
        })
      });

      if (response && response.success !== false) {
        // Generate AI-powered highlight clips
        const highlights = generateAIHighlights(video, response.data || {});
        setVideoClips(prev => ({
          ...prev,
          [videoId]: highlights
        }));

        // Update video status
        setUploadedVideos(prev => prev.map(v =>
          v.id === videoId ? { ...v, status: 'highlights_extracted', highlightsCount: highlights.length } : v
        ));
      } else {
        // Fallback highlight extraction
        const highlights = generateFallbackHighlights(video);
        setVideoClips(prev => ({
          ...prev,
          [videoId]: highlights
        }));

        setUploadedVideos(prev => prev.map(v =>
          v.id === videoId ? { ...v, status: 'highlights_extracted', highlightsCount: highlights.length } : v
        ));
      }
    } catch (error) {
      console.warn('Highlight extraction failed, using fallback:', error);
      const highlights = generateFallbackHighlights(video);
      setVideoClips(prev => ({
        ...prev,
        [videoId]: highlights
      }));

      setUploadedVideos(prev => prev.map(v =>
        v.id === videoId ? { ...v, status: 'highlights_extracted', highlightsCount: highlights.length } : v
      ));
    } finally {
      setExtractingClips(null);
    }

    saveToHistory({ action: 'extract_highlights', videoId });
  }, [uploadedVideos, apiRequest, saveToHistory]);

  const generateAIHighlights = (video, aiData) => {
    const highlights = [];
    const duration = video.duration;

    // AI-powered highlight detection based on content analysis
    const highlightMoments = aiData.highlightMoments || [];

    if (highlightMoments.length > 0) {
      highlightMoments.forEach((moment, index) => {
        highlights.push({
          id: `highlight-${video.id}-${index}`,
          videoId: video.id,
          startTime: moment.startTime,
          endTime: moment.endTime,
          duration: moment.endTime - moment.startTime,
          title: moment.title || `Highlight ${index + 1}`,
          description: moment.description || 'AI-detected highlight',
          thumbnail: moment.thumbnail || video.url,
          score: moment.score || Math.random() * 40 + 60,
          type: moment.type || 'action',
          tags: moment.tags || ['highlight']
        });
      });
    } else {
      // Generate intelligent highlights based on video duration
      const numHighlights = Math.min(Math.floor(duration / 30), 8); // Up to 8 highlights
      const intervals = duration / numHighlights;

      for (let i = 0; i < numHighlights; i++) {
        const startTime = i * intervals + Math.random() * (intervals * 0.3);
        const clipDuration = Math.min(15 + Math.random() * 15, intervals * 0.7); // 15-30 seconds

        highlights.push({
          id: `highlight-${video.id}-${i}`,
          videoId: video.id,
          startTime,
          endTime: Math.min(startTime + clipDuration, duration),
          duration: Math.min(clipDuration, duration - startTime),
          title: `Highlight ${i + 1}`,
          description: 'AI-generated highlight clip',
          thumbnail: video.url,
          score: Math.floor(Math.random() * 40) + 60,
          type: ['action', 'dialogue', 'emotional', 'funny', 'educational'][Math.floor(Math.random() * 5)],
          tags: ['highlight', 'auto-generated']
        });
      }
    }

    return highlights;
  };

  const generateFallbackHighlights = (video) => {
    const highlights = [];
    const duration = video.duration;
    const numHighlights = Math.min(Math.floor(duration / 45), 6); // Fewer highlights for fallback
    const intervals = duration / numHighlights;

    for (let i = 0; i < numHighlights; i++) {
      const startTime = i * intervals + 10; // Skip first 10 seconds
      const clipDuration = Math.min(20, intervals * 0.6);

      highlights.push({
        id: `fallback-${video.id}-${i}`,
        videoId: video.id,
        startTime,
        endTime: Math.min(startTime + clipDuration, duration),
        duration: Math.min(clipDuration, duration - startTime),
        title: `Clip ${i + 1}`,
        description: 'Automatically extracted clip',
        thumbnail: video.url,
        score: Math.floor(Math.random() * 30) + 50,
        type: 'general',
        tags: ['clip', 'extracted']
      });
    }

    return highlights;
  };

  const createClipFromHighlight = useCallback((highlight) => {
    const newClip = {
      id: `clip-${Date.now()}`,
      name: highlight.title,
      url: highlight.thumbnail, // In real implementation, this would be the extracted clip URL
      duration: highlight.duration,
      type: 'highlight',
      originalVideoId: highlight.videoId,
      startTime: highlight.startTime,
      endTime: highlight.endTime,
      status: 'ready',
      folder: 'clips',
      tags: highlight.tags,
      createdFrom: highlight.id,
      uploadDate: new Date().toISOString()
    };

    setUploadedVideos(prev => [newClip, ...prev]);
    saveToHistory({ action: 'create_clip_from_highlight', highlightId: highlight.id, clip: newClip });
  }, [saveToHistory]);

  const uploadClip = useCallback(async (clipId) => {
    const clip = uploadedVideos.find(v => v.id === clipId);
    if (!clip) return;

    // Simulate upload process
    setUploadedVideos(prev => prev.map(v =>
      v.id === clipId ? { ...v, status: 'uploading' } : v
    ));

    try {
      // In real implementation, this would upload to a server
      await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate upload

      setUploadedVideos(prev => prev.map(v =>
        v.id === clipId ? { ...v, status: 'uploaded', uploadedAt: new Date().toISOString() } : v
      ));

      alert(`Clip "${clip.name}" uploaded successfully!`);
      saveToHistory({ action: 'upload_clip', clipId });
    } catch (error) {
      setUploadedVideos(prev => prev.map(v =>
        v.id === clipId ? { ...v, status: 'upload_failed' } : v
      ));
      alert('Upload failed. Please try again.');
    }
  }, [uploadedVideos, saveToHistory]);

  const EditingPanel = () => {
    if (!selectedVideo) return null;

    return (
      <div className="editing-panel">
        <div className="panel-header">
          <h4>🎬 Editing: {selectedVideo.name}</h4>
          <div className="edit-tabs">
            <button className={editingMode === 'auto' ? 'active' : ''} onClick={() => setEditingMode('auto')}>
              🤖 Auto-Edit
            </button>
            <button className={editingMode === 'manual' ? 'active' : ''} onClick={() => setEditingMode('manual')}>
              🎨 Manual
            </button>
          </div>
        </div>

        <div className="panel-content">
          {editingMode === 'auto' && selectedVideo.analysis && (
            <div className="auto-edit-panel">
              <div className="analysis-header">
                <h5>🤖 AI Analysis Complete</h5>
                <div className="analysis-summary">
                  <span className="content-type">📊 {selectedVideo.analysis.contentType}</span>
                  <span className="mood">🎭 {selectedVideo.analysis.mood}</span>
                  {selectedVideo.analysis.viralPotential && (
                    <span className="viral-score">🚀 {selectedVideo.analysis.viralPotential.score}/100</span>
                  )}
                </div>
              </div>

              <div className="ai-insights">
                <div className="insight-section">
                  <h6>🎯 Smart Edits</h6>
                  <div className="suggestions-grid">
                    {selectedVideo.analysis.suggestedEdits?.map((edit, idx) => (
                      <div key={idx} className="suggestion-card">
                        <div className="suggestion-icon">
                          {edit.type === 'hook' && '🎣'}
                          {edit.type === 'text' && '📝'}
                          {edit.type === 'music' && '🎵'}
                          {edit.type === 'highlight' && '⭐'}
                        </div>
                        <div className="suggestion-content">
                          <h6>{edit.type.toUpperCase()}</h6>
                          <p>{edit.reason}</p>
                          <button
                            className="apply-btn"
                            onClick={() => applyEdit(edit.type, edit)}
                          >
                            Apply
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedVideo.analysis.voiceHookSuggestions && (
                  <div className="insight-section">
                    <h6>🎤 Voice Hooks</h6>
                    <div className="voice-hooks">
                      {selectedVideo.analysis.voiceHookSuggestions.slice(0, 3).map((hook, idx) => (
                        <div key={idx} className="voice-hook-card">
                          <div className="hook-text">"{hook.text}"</div>
                          <div className="hook-stats">📈 {hook.engagement}% engagement</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {editingMode === 'auto' && !selectedVideo.analysis && selectedVideo.status === 'uploaded' && (
            <div className="auto-edit-panel">
              <div className="analysis-placeholder">
                <div className="placeholder-icon">🤖</div>
                <h5>AI Analysis Required</h5>
                <p>Run AI analysis to get smart editing suggestions</p>
                <button
                  className="analyze-btn large"
                  onClick={() => analyzeVideo(selectedVideo.id)}
                  disabled={analyzingVideo === selectedVideo.id}
                >
                  {analyzingVideo === selectedVideo.id ? '🤖 Analyzing...' : '🚀 Run AI Analysis'}
                </button>
              </div>
            </div>
          )}

          {editingMode === 'manual' && (
            <div className="manual-edit-panel">
              <h5>🎨 Manual Editing Tools</h5>
              <div className="manual-tools-grid">
                <button className="tool-btn" onClick={() => applyEdit('trim', { start: 0, end: 5 })}>
                  ✂️ Trim
                </button>
                <button className="tool-btn" onClick={() => applyEdit('filter', { type: 'brightness', value: 1.2 })}>
                  🎭 Filters
                </button>
                <button className="tool-btn" onClick={() => applyEdit('text', { content: 'Your Text Here', position: 'center' })}>
                  📝 Text
                </button>
                <button className="tool-btn" onClick={() => applyEdit('music', { genre: 'upbeat', volume: 0.3 })}>
                  🎵 Music
                </button>
                <button className="tool-btn" onClick={() => applyEdit('image', { overlay: true, position: 'bottom-right' })}>
                  🖼️ Images
                </button>
                <button className="tool-btn" onClick={() => applyEdit('captions', { autoGenerate: true })}>
                  🏷️ Captions
                </button>
                <button className="tool-btn" onClick={() => applyEdit('voiceHook', { hookId: 'intro_attention' })}>
                  🎤 Voice Hooks
                </button>
                <button className="tool-btn export-btn" onClick={() => alert('Export functionality would be implemented here')}>
                  📤 Export
                </button>
              </div>
              <div className="upload-assets">
                <h6>📤 Custom Assets</h6>
                <div className="asset-upload-grid">
                  <button className="asset-btn">🖼️ Upload Images</button>
                  <button className="asset-btn">🎵 Upload Music</button>
                  <button className="asset-btn">🏷️ Upload Stickers</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="video-editor-dashboard">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
      />

      {/* Quick Actions Bar */}
      <div className="quick-actions-grid">
        <button
          className={`quick-action-btn primary ${isUploading ? 'uploading' : ''}`}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          disabled={isUploading}
        >
          <div className="action-icon">{isUploading ? '⏳' : '📤'}</div>
          <div className="action-text">
            {isUploading ? `Uploading...` : 'Upload Video'}
          </div>
        </button>

        <button className="quick-action-btn" onClick={() => {
          setEditingMode('auto');
          if (selectedVideo && selectedVideo.status === 'uploaded' && !selectedVideo.analysis) {
            analyzeVideo(selectedVideo.id);
          }
        }}>
          <div className="action-icon">🤖</div>
          <div className="action-text">AI Auto-Edit</div>
        </button>

        <button className="quick-action-btn" onClick={() => setEditingMode('manual')}>
          <div className="action-icon">🎨</div>
          <div className="action-text">Manual Edit</div>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="editor-main">
        <div className="editor-sidebar">
          <div className="video-list">
            <div className="video-list-header">
              <div className="header-top">
                <div className="videos-title-section">
                  <h4>📹 Your Videos ({uploadedVideos.length})</h4>
                  {uploadedVideos.filter(video => video.folder === selectedFolder).length > 0 && (
                    <button
                      className="select-all-btn"
                      onClick={() => {
                        const folderVideos = uploadedVideos.filter(video => video.folder === selectedFolder);
                        if (selectedVideos.length === folderVideos.length) {
                          setSelectedVideos([]);
                        } else {
                          setSelectedVideos(folderVideos.map(v => v.id));
                        }
                      }}
                    >
                      {selectedVideos.length === uploadedVideos.filter(video => video.folder === selectedFolder).length ? '☑️ Deselect All' : '☐ Select All'}
                    </button>
                  )}
                </div>
                <div className="search-filter-controls">
                  <div className="search-box">
                    <input
                      type="text"
                      placeholder="🔍 Search videos..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                  <select
                    value={filterBy}
                    onChange={(e) => setFilterBy(e.target.value)}
                    className="filter-select"
                  >
                    <option value="all">All Videos</option>
                    <option value="uploaded">Uploaded Only</option>
                  </select>
                </div>
              </div>
              <div className="folder-tabs">
                {Object.entries(folders).map(([folderName, videoIds]) => (
                  <button
                    key={folderName}
                    className={`folder-tab ${selectedFolder === folderName ? 'active' : ''}`}
                    onClick={() => setSelectedFolder(folderName)}
                  >
                    {folderName === 'recent' && '🕐 Recent'}
                    {folderName === 'projects' && '🎬 Projects'}
                    {folderName === 'archive' && '📦 Archive'}
                    {folderName === 'expired' && '⏰ Expired'}
                    <span className="count">({videoIds.length})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Bulk Actions Bar */}
            {selectedVideos.length > 0 && (
              <div className="bulk-actions-bar">
                <div className="bulk-info">
                  <span>{selectedVideos.length} video{selectedVideos.length !== 1 ? 's' : ''} selected</span>
                </div>
                <div className="bulk-buttons">
                  <button
                    className="bulk-btn"
                    onClick={() => {
                      const targetFolder = prompt('Move selected videos to which folder? (recent/projects/archive)');
                      if (targetFolder && ['recent', 'projects', 'archive'].includes(targetFolder)) {
                        setUploadedVideos(prev => prev.map(video =>
                          selectedVideos.includes(video.id)
                            ? { ...video, folder: targetFolder }
                            : video
                        ));
                        setSelectedVideos([]);
                      }
                    }}
                  >
                    📂 Move to Folder
                  </button>
                  <button
                    className="bulk-btn secondary"
                    onClick={() => setSelectedVideos([])}
                  >
                    ✕ Clear Selection
                  </button>
                </div>
              </div>
            )}

            {uploadedVideos.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">🎬</div>
                <p>No videos uploaded yet</p>
                <button className="action-btn" onClick={() => fileInputRef.current?.click()}>
                  Upload Your First Video
                </button>
              </div>
            ) : (
              <div className="video-grid">
                {uploadedVideos.filter(video => {
                  // Filter by folder
                  if (video.folder !== selectedFolder) return false;

                  // Filter by search query
                  if (searchQuery.trim()) {
                    const query = searchQuery.toLowerCase();
                    if (!video.name.toLowerCase().includes(query)) return false;
                  }

                  // Filter by status
                  if (filterBy !== 'all' && video.status !== filterBy) return false;

                  return true;
                }).map(video => (
                  <div
                    key={video.id}
                    className="video-card"
                    onClick={() => {
                      if (selectedVideos.length > 0) return;

                      // Deep sanitization to ensure complete serializability
                      const sanitizeValue = (value) => {
                        if (value === null || value === undefined) return value;
                        if (typeof value === 'string') return value;
                        if (typeof value === 'number') return value;
                        if (typeof value === 'boolean') return value;
                        if (Array.isArray(value)) {
                          return value.map(item => sanitizeValue(item)).filter(item => item !== undefined);
                        }
                        if (typeof value === 'object') {
                          const sanitized = {};
                          Object.keys(value).forEach(key => {
                            if (key !== 'file' && key !== '_id' && key !== '__v') {
                              const cleanValue = sanitizeValue(value[key]);
                              if (cleanValue !== undefined) {
                                sanitized[key] = cleanValue;
                              }
                            }
                          });
                          return Object.keys(sanitized).length > 0 ? sanitized : undefined;
                        }
                        return undefined; // Skip complex objects
                      };

                      // Create minimal safe video object
                      const safeVideo = {
                        id: String(video.id),
                        name: String(video.name || ''),
                        size: Number(video.size) || 0,
                        type: String(video.type || ''),
                        url: String(video.url || ''),
                        duration: Number(video.duration) || 0,
                        status: String(video.status || 'unknown'),
                        highlightsCount: Number(video.highlightsCount) || 0,
                        folder: String(video.folder || 'recent'),
                        tags: Array.isArray(video.tags) ? video.tags.map(String) : [],
                        uploadDate: video.uploadDate ? String(video.uploadDate) : undefined,
                        createdAt: video.createdAt ? String(video.createdAt) : undefined
                      };

                      // Safely add analysis if it exists and is simple
                      if (video.analysis && typeof video.analysis === 'object') {
                        const safeAnalysis = {};
                        if (video.analysis.contentType) safeAnalysis.contentType = String(video.analysis.contentType);
                        if (video.analysis.mood) safeAnalysis.mood = String(video.analysis.mood);
                        if (video.analysis.viralPotential?.score) safeAnalysis.viralPotential = { score: Number(video.analysis.viralPotential.score) };
                        if (Object.keys(safeAnalysis).length > 0) {
                          safeVideo.analysis = safeAnalysis;
                        }
                      }

                      // Final verification - ensure complete serializability
                      try {
                        JSON.stringify(safeVideo); // Test serialization
                        console.log('Navigation state sanitized successfully for video:', safeVideo.name);
                        navigate(`/editor/${video.id}`, { state: { video: safeVideo } });
                      } catch (error) {
                        console.error('Serialization failed, using minimal video object:', error);
                        const minimalVideo = {
                          id: String(video.id),
                          name: String(video.name || 'Unknown Video'),
                          url: String(video.url || ''),
                          duration: Number(video.duration) || 0
                        };
                        console.log('Using minimal video object:', minimalVideo);
                        navigate(`/editor/${video.id}`, { state: { video: minimalVideo } });
                      }
                    }}
                  >
                    <div className="video-thumbnail">
                      <input
                        type="checkbox"
                        className="video-checkbox"
                        checked={selectedVideos.includes(video.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (e.target.checked) {
                            setSelectedVideos(prev => [...prev, video.id]);
                          } else {
                            setSelectedVideos(prev => prev.filter(id => id !== video.id));
                          }
                        }}
                      />
                      <div className="thumbnail-placeholder">🎬</div>
                      <div className="video-status">{video.status}</div>
                    </div>
                    <div className="video-info">
                      <h5>{video.name}</h5>
                      <p>{(video.size / (1024 * 1024)).toFixed(1)} MB</p>
                      {video.status === 'uploaded' && (
                        <button
                          className="analyze-btn"
                          onClick={(e) => { e.stopPropagation(); analyzeVideo(video.id); }}
                          disabled={analyzingVideo === video.id}
                        >
                          {analyzingVideo === video.id ? '🤖 Analyzing...' : '🤖 Analyze'}
                        </button>
                      )}
                      {video.status === 'analyzing' && (
                        <div className="analyzing">Analyzing... 🤖</div>
                      )}
                      {video.status === 'analyzed' && (
                        <div className="analyzed">
                          ✅ Analyzed
                          <div className="analysis-preview">
                            {video.analysis?.contentType && <span>{video.analysis.contentType}</span>}
                            {video.analysis?.viralPotential?.score && <span>{video.analysis.viralPotential.score}/100</span>}
                          </div>
                        </div>
                      )}
                      {video.status === 'analyzed' && !video.highlightsCount && (
                        <div className="highlight-ready">
                          <button
                            className="highlight-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              extractHighlights(video.id);
                            }}
                            disabled={extractingClips === video.id}
                          >
                            {extractingClips === video.id ? '🎬 Extracting...' : '🎬 Extract Highlights'}
                          </button>
                        </div>
                      )}
                      {video.status === 'highlights_extracted' && (
                        <div className="highlights-extracted">
                          ✅ {video.highlightsCount} highlights extracted
                          <button
                            className="view-highlights-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedClip(video.id);
                            }}
                          >
                            👀 View Clips
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="editor-workspace">
          {selectedVideo ? (
            <EditingPanel />
          ) : (
            <div className="workspace-placeholder">
              <div className="placeholder-icon">🎬</div>
              <h4>Welcome to Click Video Editor</h4>
              <p>Upload a video to get started</p>
            </div>
          )}
        </div>
      </div>

      {/* Highlights Modal */}
      {selectedClip && videoClips[selectedClip] && (
        <div className="modal-overlay" onClick={() => setSelectedClip(null)}>
          <div className="modal-content highlights-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🎬 Extracted Highlights</h3>
              <button onClick={() => setSelectedClip(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="highlights-grid">
                {videoClips[selectedClip].map((highlight) => (
                  <div key={highlight.id} className="highlight-card">
                    <div className="highlight-thumbnail">
                      <div className="thumbnail-placeholder">
                        <span>🎬</span>
                        <small>{Math.floor(highlight.startTime)}s - {Math.floor(highlight.endTime)}s</small>
                      </div>
                      <div className="highlight-score">{highlight.score}/100</div>
                    </div>
                    <div className="highlight-info">
                      <h4>{highlight.title}</h4>
                      <p>{highlight.description}</p>
                      <div className="highlight-meta">
                        <span className="highlight-type">{highlight.type}</span>
                        <span className="highlight-duration">{highlight.duration.toFixed(1)}s</span>
                      </div>
                      <div className="highlight-tags">
                        {highlight.tags.map(tag => (
                          <span key={tag} className="tag">{tag}</span>
                        ))}
                      </div>
                      <div className="highlight-actions">
                        <button
                          className="create-clip-btn"
                          onClick={() => {
                            createClipFromHighlight(highlight);
                            setSelectedClip(null);
                          }}
                        >
                          ✂️ Create Clip
                        </button>
                        <button
                          className="edit-btn"
                          onClick={() => {
                            // Navigate to editor with this highlight pre-loaded
                            navigate(`/editor/${highlight.id}`, {
                              state: {
                                video: {
                                  id: highlight.id,
                                  name: highlight.title,
                                  url: highlight.thumbnail,
                                  duration: highlight.duration,
                                  startTime: highlight.startTime,
                                  endTime: highlight.endTime,
                                  originalVideoId: highlight.videoId,
                                  type: 'highlight'
                                }
                              }
                            });
                          }}
                        >
                          🎨 Edit Clip
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Clips Management Section */}
      {uploadedVideos.some(v => v.type === 'highlight') && (
        <div className="clips-section">
          <h3>🎬 Your Highlight Clips</h3>
          <div className="clips-grid">
            {uploadedVideos
              .filter(v => v.type === 'highlight')
              .map(clip => (
                <div key={clip.id} className="clip-card">
                  <div className="clip-thumbnail">
                    <div className="clip-placeholder">🎬</div>
                    <div className="clip-duration">{clip.duration.toFixed(1)}s</div>
                  </div>
                  <div className="clip-info">
                    <h4>{clip.name}</h4>
                    <div className="clip-status">
                      {clip.status === 'ready' && <span className="status-ready">✅ Ready</span>}
                      {clip.status === 'uploading' && <span className="status-uploading">📤 Uploading...</span>}
                      {clip.status === 'uploaded' && <span className="status-uploaded">🌐 Uploaded</span>}
                      {clip.status === 'upload_failed' && <span className="status-failed">❌ Failed</span>}
                    </div>
                    <div className="clip-actions">
                      <button
                        className="edit-clip-btn"
                        onClick={() => navigate(`/editor/${clip.id}`, { state: { video: clip } })}
                      >
                        🎨 Edit
                      </button>
                      {clip.status === 'ready' && (
                        <button
                          className="upload-clip-btn"
                          onClick={() => uploadClip(clip.id)}
                        >
                          📤 Upload
                        </button>
                      )}
                      <button
                        className="delete-clip-btn"
                        onClick={() => {
                          setUploadedVideos(prev => prev.filter(v => v.id !== clip.id));
                        }}
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoEditorDashboard;
