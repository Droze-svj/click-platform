import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const CaptionStyleEditor = ({ style, onStyleChange, onApply }) => {
  const { apiRequest } = useAuth();
  const [presets, setPresets] = useState({});
  const [fonts, setFonts] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadPresets();
    loadFonts();
  }, []);

  const loadPresets = async () => {
    try {
      const { data } = await apiRequest('/video/manual-editing/caption-presets');
      if (data.success) {
        setPresets(data.data.presets);
      }
    } catch (error) {
      console.error('Failed to load caption presets:', error);
    }
  };

  const loadFonts = async () => {
    try {
      const { data } = await apiRequest('/video/manual-editing/fonts');
      if (data.success) {
        setFonts(data.data.fonts);
      }
    } catch (error) {
      console.error('Failed to load fonts:', error);
    }
  };

  const applyPreset = (presetName) => {
    if (presets[presetName]) {
      onStyleChange(presets[presetName]);
    }
  };

  const handleStyleChange = (property, value) => {
    onStyleChange({
      ...style,
      [property]: value
    });
  };

  const generatePreviewText = () => {
    return "This is how your captions will look";
  };

  return (
    <div className="caption-style-editor">
      <h3>🎨 Caption Style Editor</h3>

      {/* Preset Styles */}
      <div className="style-presets">
        <h4>Quick Presets:</h4>
        <div className="preset-buttons">
          {Object.keys(presets).map(presetName => (
            <button
              key={presetName}
              onClick={() => applyPreset(presetName)}
              className="preset-btn"
            >
              {presetName.charAt(0).toUpperCase() + presetName.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Font Settings */}
      <div className="style-section">
        <h4>Font Settings</h4>
        <div className="style-controls">
          <div className="control-group">
            <label>Font Family:</label>
            <select
              value={style.fontFamily || 'Arial'}
              onChange={(e) => handleStyleChange('fontFamily', e.target.value)}
            >
              {fonts.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </div>

          <div className="control-group">
            <label>Font Size:</label>
            <input
              type="number"
              value={style.fontSize || 24}
              onChange={(e) => handleStyleChange('fontSize', parseInt(e.target.value))}
              min="12"
              max="72"
            />
          </div>

          <div className="control-group">
            <label>Font Color:</label>
            <input
              type="color"
              value={style.fontColor || '#ffffff'}
              onChange={(e) => handleStyleChange('fontColor', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Background Settings */}
      <div className="style-section">
        <h4>Background Settings</h4>
        <div className="style-controls">
          <div className="control-group">
            <label>Background Color:</label>
            <input
              type="color"
              value={style.backgroundColor?.split('@')[0] || '#000000'}
              onChange={(e) => {
                const opacity = style.backgroundColor?.split('@')[1] || '0.5';
                handleStyleChange('backgroundColor', `${e.target.value}@${opacity}`);
              }}
            />
          </div>

          <div className="control-group">
            <label>Background Opacity:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={style.backgroundColor?.split('@')[1] || 0.5}
              onChange={(e) => {
                const color = style.backgroundColor?.split('@')[0] || '#000000';
                handleStyleChange('backgroundColor', `${color}@${e.target.value}`);
              }}
            />
            <span>{Math.round((style.backgroundColor?.split('@')[1] || 0.5) * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Outline Settings */}
      <div className="style-section">
        <h4>Outline Settings</h4>
        <div className="style-controls">
          <div className="control-group">
            <label>Outline Color:</label>
            <input
              type="color"
              value={style.outlineColor || '#000000'}
              onChange={(e) => handleStyleChange('outlineColor', e.target.value)}
            />
          </div>

          <div className="control-group">
            <label>Outline Width:</label>
            <input
              type="number"
              value={style.outlineWidth || 2}
              onChange={(e) => handleStyleChange('outlineWidth', parseInt(e.target.value))}
              min="0"
              max="10"
            />
          </div>
        </div>
      </div>

      {/* Position Settings */}
      <div className="style-section">
        <h4>Position Settings</h4>
        <div className="style-controls">
          <div className="control-group">
            <label>Position:</label>
            <select
              value={style.position || 'bottom'}
              onChange={(e) => handleStyleChange('position', e.target.value)}
            >
              <option value="top">Top</option>
              <option value="center">Center</option>
              <option value="bottom">Bottom</option>
            </select>
          </div>

          <div className="control-group">
            <label>Margin:</label>
            <input
              type="number"
              value={style.margin || 20}
              onChange={(e) => handleStyleChange('margin', parseInt(e.target.value))}
              min="0"
              max="100"
            />
          </div>
        </div>
      </div>

      {/* Preview */}
      <div className="style-section">
        <h4>Preview</h4>
        <div className="caption-preview">
          <div
            className="preview-text"
            style={{
              fontFamily: style.fontFamily || 'Arial',
              fontSize: `${style.fontSize || 24}px`,
              color: style.fontColor || '#ffffff',
              backgroundColor: style.backgroundColor || 'rgba(0,0,0,0.5)',
              textShadow: style.outlineWidth ?
                `${style.outlineWidth}px ${style.outlineWidth}px 0 ${style.outlineColor || '#000000'}` : 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              display: 'inline-block',
              position: style.position === 'center' ? 'absolute' : 'relative',
              top: style.position === 'center' ? '50%' : 'auto',
              transform: style.position === 'center' ? 'translateY(-50%)' : 'none',
              marginTop: style.position === 'bottom' ? `${style.margin || 20}px` : 'auto',
              marginBottom: style.position === 'top' ? `${style.margin || 20}px` : 'auto'
            }}
          >
            {generatePreviewText()}
          </div>
        </div>
      </div>

      {/* Apply Button */}
      <div className="style-actions">
        <button onClick={onApply} disabled={loading} className="apply-btn">
          {loading ? 'Applying...' : 'Apply Caption Style'}
        </button>
      </div>
    </div>
  );
};

export default CaptionStyleEditor;





