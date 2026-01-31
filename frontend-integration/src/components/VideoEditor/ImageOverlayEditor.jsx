import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const ImageOverlayEditor = ({ overlays, onOverlaysChange, currentTime, videoDuration, videoDimensions }) => {
  const { apiRequest } = useAuth();
  const [selectedOverlayIndex, setSelectedOverlayIndex] = useState(-1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [userAssets, setUserAssets] = useState({ images: [], stickers: [] });
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadUserAssets();
  }, []);

  const loadUserAssets = async () => {
    try {
      const { data } = await apiRequest('/video/manual-editing/user-assets');
      if (data.success) {
        setUserAssets(data.data.assets);
      }
    } catch (error) {
      console.error('Failed to load user assets:', error);
    }
  };

  const addImageOverlay = (imageUrl, type = 'image') => {
    const newOverlay = {
      imageUrl,
      type,
      x: 50,
      y: 50,
      width: type === 'sticker' ? 80 : 150,
      height: type === 'sticker' ? 80 : 100,
      opacity: 1,
      rotation: 0,
      start: currentTime,
      end: Math.min(currentTime + 5, videoDuration)
    };

    const updatedOverlays = [...overlays, newOverlay];
    onOverlaysChange(updatedOverlays);
    setSelectedOverlayIndex(updatedOverlays.length - 1);
  };

  const updateOverlay = (index, updates) => {
    const updatedOverlays = [...overlays];
    updatedOverlays[index] = { ...updatedOverlays[index], ...updates };
    onOverlaysChange(updatedOverlays);
  };

  const deleteOverlay = (index) => {
    const updatedOverlays = overlays.filter((_, i) => i !== index);
    onOverlaysChange(updatedOverlays);
    if (selectedOverlayIndex === index) {
      setSelectedOverlayIndex(-1);
    } else if (selectedOverlayIndex > index) {
      setSelectedOverlayIndex(selectedOverlayIndex - 1);
    }
  };

  const duplicateOverlay = (index) => {
    const overlay = overlays[index];
    const duplicated = {
      ...overlay,
      start: overlay.end + 0.1,
      end: overlay.end + (overlay.end - overlay.start) + 0.1
    };
    const updatedOverlays = [...overlays, duplicated];
    onOverlaysChange(updatedOverlays);
    setSelectedOverlayIndex(updatedOverlays.length - 1);
  };

  const handleMouseDown = (e, index) => {
    e.preventDefault();
    setSelectedOverlayIndex(index);
    setIsDragging(true);

    const overlay = overlays[index];
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging || selectedOverlayIndex === -1) return;

    const containerRect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - containerRect.left - dragOffset.x) / containerRect.width) * 100;
    const y = ((e.clientY - containerRect.top - dragOffset.y) / containerRect.height) * 100;

    updateOverlay(selectedOverlayIndex, {
      x: Math.max(0, Math.min(100, x)),
      y: Math.max(0, Math.min(100, y))
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const uploadCustomAssets = async (files, type) => {
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append(type === 'images' ? 'images' : 'stickers', file);
    });

    try {
      const { data } = await apiRequest('/video/manual-editing/upload-assets', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        // Reload user assets
        loadUserAssets();
        alert(`${files.length} ${type} uploaded successfully!`);
      }
    } catch (error) {
      console.error('Asset upload failed:', error);
      alert('Failed to upload assets');
    }
  };

  const selectedOverlay = selectedOverlayIndex >= 0 ? overlays[selectedOverlayIndex] : null;

  return (
    <div className="image-overlay-editor">
      <h3>🖼️ Image & Sticker Overlays</h3>

      <div className="overlay-controls">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="upload-btn"
        >
          📤 Upload Images/Stickers
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = e.target.files;
            if (files && files.length > 0) {
              const imageFiles = Array.from(files).filter(file =>
                file.type.startsWith('image/')
              );
              if (imageFiles.length > 0) {
                uploadCustomAssets(imageFiles, 'images');
              }
            }
          }}
        />
      </div>

      {/* Asset Library */}
      <div className="asset-library">
        {/* Built-in Stickers */}
        <div className="asset-section">
          <h4>Built-in Stickers</h4>
          <div className="asset-grid">
            {['😊', '❤️', '👍', '🔥', '⭐', '✨', '🌈', '🦋', '🌸', '👑'].map((sticker, index) => (
              <div
                key={index}
                className="asset-item sticker-item"
                onClick={() => addImageOverlay(sticker, 'sticker')}
                title="Click to add to video"
              >
                <span style={{ fontSize: '24px' }}>{sticker}</span>
              </div>
            ))}
          </div>
        </div>

        {/* User Uploaded Assets */}
        {userAssets.images.length > 0 && (
          <div className="asset-section">
            <h4>Your Images</h4>
            <div className="asset-grid">
              {userAssets.images.map(asset => (
                <div
                  key={asset.id}
                  className="asset-item"
                  onClick={() => addImageOverlay(asset.url, 'image')}
                  title="Click to add to video"
                >
                  <img src={asset.url} alt={asset.name} />
                </div>
              ))}
            </div>
          </div>
        )}

        {userAssets.stickers.length > 0 && (
          <div className="asset-section">
            <h4>Your Stickers</h4>
            <div className="asset-grid">
              {userAssets.stickers.map(asset => (
                <div
                  key={asset.id}
                  className="asset-item"
                  onClick={() => addImageOverlay(asset.url, 'sticker')}
                  title="Click to add to video"
                >
                  <img src={asset.url} alt={asset.name} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Timeline Visualization */}
      <div className="timeline-preview">
        <div
          className="timeline-track"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {overlays.map((overlay, index) => (
            <div
              key={index}
              className={`timeline-overlay ${selectedOverlayIndex === index ? 'selected' : ''}`}
              style={{
                left: `${(overlay.start / videoDuration) * 100}%`,
                width: `${((overlay.end - overlay.start) / videoDuration) * 100}%`,
                background: overlay.type === 'sticker' ? '#ff6b35' : '#4fc3f7'
              }}
              onClick={() => setSelectedOverlayIndex(index)}
            >
              <span className="overlay-text">
                {overlay.type === 'sticker' ? overlay.imageUrl : 'IMG'}
              </span>
            </div>
          ))}
          <div
            className="current-time-indicator"
            style={{ left: `${(currentTime / videoDuration) * 100}%` }}
          />
        </div>
        <div className="timeline-markers">
          <span>0s</span>
          <span>{Math.floor(videoDuration / 2)}s</span>
          <span>{Math.floor(videoDuration)}s</span>
        </div>
      </div>

      {/* Overlay List */}
      <div className="overlays-list">
        {overlays.map((overlay, index) => (
          <div
            key={index}
            className={`overlay-item ${selectedOverlayIndex === index ? 'selected' : ''}`}
            onClick={() => setSelectedOverlayIndex(index)}
          >
            <div className="overlay-preview">
              {overlay.type === 'sticker' && overlay.imageUrl.length === 1 ? (
                <span style={{ fontSize: '24px' }}>{overlay.imageUrl}</span>
              ) : (
                <img
                  src={overlay.imageUrl}
                  alt="Overlay preview"
                  style={{
                    width: '40px',
                    height: '40px',
                    objectFit: 'cover',
                    borderRadius: '4px'
                  }}
                />
              )}
            </div>
            <div className="overlay-info">
              <span className="overlay-type">{overlay.type.toUpperCase()}</span>
              <span className="overlay-timing">{overlay.start.toFixed(1)}s - {overlay.end.toFixed(1)}s</span>
            </div>
            <div className="overlay-actions">
              <button onClick={(e) => { e.stopPropagation(); duplicateOverlay(index); }}>📋</button>
              <button onClick={(e) => { e.stopPropagation(); deleteOverlay(index); }}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Overlay Editor */}
      {selectedOverlay && (
        <div className="overlay-editor">
          <h4>Edit {selectedOverlay.type === 'sticker' ? 'Sticker' : 'Image'} Overlay</h4>

          <div className="editor-section">
            <label>Timing:</label>
            <div className="timing-controls">
              <input
                type="number"
                value={selectedOverlay.start}
                onChange={(e) => updateOverlay(selectedOverlayIndex, { start: parseFloat(e.target.value) })}
                step="0.1"
                min="0"
                max={selectedOverlay.end}
              />
              <span>to</span>
              <input
                type="number"
                value={selectedOverlay.end}
                onChange={(e) => updateOverlay(selectedOverlayIndex, { end: parseFloat(e.target.value) })}
                step="0.1"
                min={selectedOverlay.start}
                max={videoDuration}
              />
              <span>seconds</span>
            </div>
          </div>

          <div className="editor-section">
            <label>Position & Size:</label>
            <div className="position-controls">
              <div className="control-row">
                <label>X: <input
                  type="number"
                  value={selectedOverlay.x}
                  onChange={(e) => updateOverlay(selectedOverlayIndex, { x: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.1"
                />%</label>
                <label>Y: <input
                  type="number"
                  value={selectedOverlay.y}
                  onChange={(e) => updateOverlay(selectedOverlayIndex, { y: parseFloat(e.target.value) })}
                  min="0"
                  max="100"
                  step="0.1"
                />%</label>
              </div>
              <div className="control-row">
                <label>Width: <input
                  type="number"
                  value={selectedOverlay.width}
                  onChange={(e) => updateOverlay(selectedOverlayIndex, { width: parseInt(e.target.value) })}
                  min="10"
                  max="500"
                />px</label>
                <label>Height: <input
                  type="number"
                  value={selectedOverlay.height}
                  onChange={(e) => updateOverlay(selectedOverlayIndex, { height: parseInt(e.target.value) })}
                  min="10"
                  max="500"
                />px</label>
              </div>
            </div>
          </div>

          <div className="editor-section">
            <label>Effects:</label>
            <div className="effects-controls">
              <label>Opacity: <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={selectedOverlay.opacity}
                onChange={(e) => updateOverlay(selectedOverlayIndex, { opacity: parseFloat(e.target.value) })}
              /> {Math.round(selectedOverlay.opacity * 100)}%</label>

              <label>Rotation: <input
                type="number"
                value={selectedOverlay.rotation}
                onChange={(e) => updateOverlay(selectedOverlayIndex, { rotation: parseInt(e.target.value) })}
                min="0"
                max="360"
              />°</label>
            </div>
          </div>
        </div>
      )}

      {overlays.length > 0 && (
        <div className="apply-actions">
          <p>Ready to apply {overlays.length} image/sticker overlay{overlays.length > 1 ? 's' : ''} to your video</p>
          <button className="apply-btn">Apply Image Overlays</button>
        </div>
      )}
    </div>
  );
};

export default ImageOverlayEditor;





