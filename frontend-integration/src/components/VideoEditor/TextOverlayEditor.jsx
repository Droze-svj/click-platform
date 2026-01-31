import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const TextOverlayEditor = ({ overlays, onOverlaysChange, currentTime, videoDuration }) => {
  const { apiRequest } = useAuth();
  const [availableFonts, setAvailableFonts] = useState([]);
  const [selectedOverlayIndex, setSelectedOverlayIndex] = useState(-1);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    loadFonts();
  }, []);

  const loadFonts = async () => {
    try {
      const { data } = await apiRequest('/video/manual-editing/fonts');
      if (data.success) {
        setAvailableFonts(data.data.fonts);
      }
    } catch (error) {
      console.error('Failed to load fonts:', error);
    }
  };

  const addTextOverlay = () => {
    const newOverlay = {
      text: 'Your Text Here',
      x: 50,
      y: 50,
      fontsize: 24,
      fontcolor: '#ffffff',
      fontfile: null,
      box: 1,
      boxcolor: '#000000@0.5',
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

  const selectedOverlay = selectedOverlayIndex >= 0 ? overlays[selectedOverlayIndex] : null;

  return (
    <div className="text-overlay-editor">
      <h3>📝 Text Overlays</h3>

      <div className="overlay-controls">
        <button onClick={addTextOverlay} className="add-btn">
          + Add Text Overlay
        </button>
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="toggle-btn">
          {showAdvanced ? 'Simple' : 'Advanced'} Mode
        </button>
      </div>

      {/* Timeline Visualization */}
      <div className="timeline-preview">
        <div className="timeline-track">
          {overlays.map((overlay, index) => (
            <div
              key={index}
              className={`timeline-overlay ${selectedOverlayIndex === index ? 'selected' : ''}`}
              style={{
                left: `${(overlay.start / videoDuration) * 100}%`,
                width: `${((overlay.end - overlay.start) / videoDuration) * 100}%`
              }}
              onClick={() => setSelectedOverlayIndex(index)}
            >
              <span className="overlay-text">{overlay.text.substring(0, 10)}...</span>
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
              <span style={{
                fontSize: `${overlay.fontsize}px`,
                color: overlay.fontcolor,
                backgroundColor: overlay.boxcolor,
                padding: '4px 8px',
                borderRadius: '4px'
              }}>
                {overlay.text}
              </span>
            </div>
            <div className="overlay-timing">
              {overlay.start.toFixed(1)}s - {overlay.end.toFixed(1)}s
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
          <h4>Edit Text Overlay</h4>

          <div className="editor-section">
            <label>Text Content:</label>
            <textarea
              value={selectedOverlay.text}
              onChange={(e) => updateOverlay(selectedOverlayIndex, { text: e.target.value })}
              rows="3"
            />
          </div>

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

          {showAdvanced ? (
            <>
              <div className="editor-section">
                <label>Font Settings:</label>
                <div className="font-controls">
                  <select
                    value={selectedOverlay.fontfile || ''}
                    onChange={(e) => updateOverlay(selectedOverlayIndex, { fontfile: e.target.value || null })}
                  >
                    <option value="">System Font</option>
                    {availableFonts.map(font => (
                      <option key={font} value={font}>{font}</option>
                    ))}
                  </select>

                  <input
                    type="number"
                    value={selectedOverlay.fontsize}
                    onChange={(e) => updateOverlay(selectedOverlayIndex, { fontsize: parseInt(e.target.value) })}
                    min="12"
                    max="120"
                  />
                  <span>px</span>
                </div>
              </div>

              <div className="editor-section">
                <label>Colors:</label>
                <div className="color-controls">
                  <div className="color-input">
                    <label>Text:</label>
                    <input
                      type="color"
                      value={selectedOverlay.fontcolor}
                      onChange={(e) => updateOverlay(selectedOverlayIndex, { fontcolor: e.target.value })}
                    />
                  </div>

                  <div className="color-input">
                    <label>Background:</label>
                    <input
                      type="color"
                      value={selectedOverlay.boxcolor.split('@')[0]}
                      onChange={(e) => {
                        const opacity = selectedOverlay.boxcolor.split('@')[1] || '0.5';
                        updateOverlay(selectedOverlayIndex, { boxcolor: `${e.target.value}@${opacity}` });
                      }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={selectedOverlay.boxcolor.split('@')[1] || 0.5}
                      onChange={(e) => {
                        const color = selectedOverlay.boxcolor.split('@')[0];
                        updateOverlay(selectedOverlayIndex, { boxcolor: `${color}@${e.target.value}` });
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="editor-section">
                <label>Position:</label>
                <div className="position-controls">
                  <div>
                    <label>X:</label>
                    <input
                      type="number"
                      value={selectedOverlay.x}
                      onChange={(e) => updateOverlay(selectedOverlayIndex, { x: parseInt(e.target.value) })}
                      min="0"
                      max="100"
                    />
                    <span>%</span>
                  </div>
                  <div>
                    <label>Y:</label>
                    <input
                      type="number"
                      value={selectedOverlay.y}
                      onChange={(e) => updateOverlay(selectedOverlayIndex, { y: parseInt(e.target.value) })}
                      min="0"
                      max="100"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="simple-controls">
              <div className="quick-style">
                <label>Quick Style:</label>
                <select onChange={(e) => {
                  const style = e.target.value;
                  switch (style) {
                    case 'bold':
                      updateOverlay(selectedOverlayIndex, {
                        fontsize: 32,
                        fontcolor: 'yellow',
                        boxcolor: 'black@0.7'
                      });
                      break;
                    case 'subtle':
                      updateOverlay(selectedOverlayIndex, {
                        fontsize: 20,
                        fontcolor: 'white',
                        boxcolor: 'black@0.3'
                      });
                      break;
                    case 'highlight':
                      updateOverlay(selectedOverlayIndex, {
                        fontsize: 28,
                        fontcolor: 'cyan',
                        boxcolor: 'blue@0.6'
                      });
                      break;
                  }
                }}>
                  <option value="">Choose Style</option>
                  <option value="bold">Bold</option>
                  <option value="subtle">Subtle</option>
                  <option value="highlight">Highlight</option>
                </select>
              </div>
            </div>
          )}
        </div>
      )}

      {overlays.length > 0 && (
        <div className="apply-actions">
          <p>Ready to apply {overlays.length} text overlay{overlays.length > 1 ? 's' : ''} to your video</p>
          <button className="apply-btn">Apply Text Overlays</button>
        </div>
      )}
    </div>
  );
};

export default TextOverlayEditor;





