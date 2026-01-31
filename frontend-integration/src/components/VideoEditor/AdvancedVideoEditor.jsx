import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import TextOverlayEditor from './TextOverlayEditor';
import MusicSelector from './MusicSelector';
import CaptionStyleEditor from './CaptionStyleEditor';
import ImageOverlayEditor from './ImageOverlayEditor';
import CustomAssetUploader from './CustomAssetUploader';
import VoiceHookSelector from './VoiceHookSelector';

const AdvancedVideoEditor = ({ videoSrc, onSave }) => {
  const { apiRequest } = useAuth();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  // Editor state
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);

  // Editing tools state
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [brightness, setBrightness] = useState(0);
  const [contrast, setContrast] = useState(1);
  const [saturation, setSaturation] = useState(1);

  // Text overlays
  const [textOverlays, setTextOverlays] = useState([]);
  const [selectedTextIndex, setSelectedTextIndex] = useState(-1);
  const [showTextEditor, setShowTextEditor] = useState(false);

  // Background music
  const [backgroundMusic, setBackgroundMusic] = useState(null);
  const [musicVolume, setMusicVolume] = useState(0.3);

  // Captions
  const [captions, setCaptions] = useState([]);
  const [captionStyle, setCaptionStyle] = useState({
    fontSize: 24,
    fontColor: 'white',
    backgroundColor: 'black@0.5',
    position: 'bottom'
  });

  // Image overlays
  const [imageOverlays, setImageOverlays] = useState([]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 1920, height: 1080 });

  // Voice hooks
  const [selectedVoiceHook, setSelectedVoiceHook] = useState(null);
  const [voiceHookStartTime, setVoiceHookStartTime] = useState(0);

  // Layout
  const [layoutType, setLayoutType] = useState('single');
  const [layoutElements, setLayoutElements] = useState([]);

  // Component initialization
  useEffect(() => {
    // Any initialization logic here
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      setTrimEnd(videoRef.current.duration);
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const seekToTime = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Manual editing functions
  const applyTrim = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));
      formData.append('edits', JSON.stringify({
        trim: { start: trimStart, end: trimEnd }
      }));

      const { data } = await apiRequest('/video/manual-editing/apply-edits', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.editedVideoPath);
      }
    } catch (error) {
      console.error('Trim failed:', error);
    }
    setLoading(false);
  };

  const applySpeedChange = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));
      formData.append('edits', JSON.stringify({ speed }));

      const { data } = await apiRequest('/video/manual-editing/apply-edits', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.editedVideoPath);
      }
    } catch (error) {
      console.error('Speed change failed:', error);
    }
    setLoading(false);
  };

  const applyFilters = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));
      formData.append('edits', JSON.stringify({
        filters: { brightness, contrast, saturation }
      }));

      const { data } = await apiRequest('/video/manual-editing/apply-edits', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.editedVideoPath);
      }
    } catch (error) {
      console.error('Filter application failed:', error);
    }
    setLoading(false);
  };

  // Text overlay functions
  const addTextOverlay = () => {
    const newText = {
      text: 'Your Text Here',
      x: 50,
      y: 50,
      fontsize: 24,
      fontcolor: 'white',
      start: currentTime,
      end: currentTime + 5
    };
    setTextOverlays([...textOverlays, newText]);
    setSelectedTextIndex(textOverlays.length);
    setShowTextEditor(true);
  };

  const updateTextOverlay = (index, updates) => {
    const updated = [...textOverlays];
    updated[index] = { ...updated[index], ...updates };
    setTextOverlays(updated);
  };

  const applyTextOverlays = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));
      formData.append('textConfigs', JSON.stringify(textOverlays));

      const { data } = await apiRequest('/video/manual-editing/add-text', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.videoWithTextPath);
      }
    } catch (error) {
      console.error('Text overlay failed:', error);
    }
    setLoading(false);
  };

  // Image overlay functions
  const applyImageOverlays = async () => {
    if (imageOverlays.length === 0) return;

    setLoading(true);
    try {
      const formData = new FormData();

      // Add video file
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));

      // Add image files
      const imageFiles = [];
      for (const overlay of imageOverlays) {
        if (overlay.type === 'sticker' && overlay.imageUrl.length === 1) {
          // For emoji stickers, we'll need to create an image
          // For now, skip emoji overlays in processing
          continue;
        }
        try {
          const response = await fetch(overlay.imageUrl);
          const blob = await response.blob();
          formData.append('images', blob);
          imageFiles.push(overlay);
        } catch (error) {
          console.warn('Failed to load image:', overlay.imageUrl);
        }
      }

      formData.append('imageConfigs', JSON.stringify(imageFiles));

      const { data } = await apiRequest('/video/manual-editing/add-images', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.videoWithImagesPath);
      }
    } catch (error) {
      console.error('Image overlay application failed:', error);
    }
    setLoading(false);
  };

  // Voice hook functions
  const applyVoiceHook = async () => {
    if (!selectedVoiceHook) return;

    setLoading(true);
    try {
      const formData = new FormData();

      // Add video file
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));

      // Add voice hook file (would need to fetch the actual audio file)
      // For now, using a placeholder approach
      const voiceHookResponse = await fetch(selectedVoiceHook.url);
      const voiceHookBlob = await voiceHookResponse.blob();
      formData.append('voiceHook', voiceHookBlob);

      formData.append('options', JSON.stringify({
        startTime: voiceHookStartTime,
        volume: selectedVoiceHook.volume || 1,
        fadeIn: selectedVoiceHook.fadeIn || 0.5,
        fadeOut: selectedVoiceHook.fadeOut || 0.5,
        overlay: true
      }));

      const { data } = await apiRequest('/video/voice-hooks/add-to-video', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.videoWithVoiceHookPath);
      }
    } catch (error) {
      console.error('Voice hook application failed:', error);
    }
    setLoading(false);
  };

  // Asset upload handler
  const handleAssetUploaded = (uploadData) => {
    // Refresh any asset lists if needed
    console.log('Assets uploaded:', uploadData);
  };

  // Music functions
  const addBackgroundMusic = async (musicTrack) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));
      formData.append('music', await fetch(musicTrack.url).then(r => r.blob()));
      formData.append('options', JSON.stringify({
        volume: musicVolume,
        fadeIn: 2,
        fadeOut: 2
      }));

      const { data } = await apiRequest('/video/manual-editing/add-music', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.videoWithMusicPath);
      }
    } catch (error) {
      console.error('Background music addition failed:', error);
    }
    setLoading(false);
  };

  // Caption functions
  const addCaption = () => {
    const newCaption = {
      text: 'Caption text',
      startTime: currentTime,
      endTime: currentTime + 3
    };
    setCaptions([...captions, newCaption]);
  };

  const applyCaptions = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('video', await fetch(videoSrc).then(r => r.blob()));
      formData.append('captions', JSON.stringify(captions));
      formData.append('styleConfig', JSON.stringify(captionStyle));

      const { data } = await apiRequest('/video/manual-editing/apply-captions', {
        method: 'POST',
        body: formData
      });

      if (data.success) {
        onSave(data.data.videoWithCaptionsPath);
      }
    } catch (error) {
      console.error('Caption application failed:', error);
    }
    setLoading(false);
  };

  return (
    <div className="advanced-video-editor">
      <div className="editor-header">
        <h2>Advanced Video Editor</h2>
        {loading && <div className="loading-spinner">Processing...</div>}
      </div>

      <div className="editor-layout">
        {/* Video Preview */}
        <div className="video-preview">
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
          />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Video Controls */}
          <div className="video-controls">
            <button onClick={togglePlayPause}>
              {isPlaying ? '⏸️' : '▶️'}
            </button>
            <input
              type="range"
              min="0"
              max={duration}
              value={currentTime}
              onChange={(e) => seekToTime(parseFloat(e.target.value))}
              step="0.1"
            />
            <span>{Math.floor(currentTime)}s / {Math.floor(duration)}s</span>
          </div>
        </div>

        {/* Editing Tools */}
        <div className="editing-tools">
          {/* Trim Tool */}
          <div className="tool-section">
            <h3>✂️ Trim Video</h3>
            <div className="trim-controls">
              <label>Start: <input type="number" value={trimStart} onChange={(e) => setTrimStart(parseFloat(e.target.value))} step="0.1" />s</label>
              <label>End: <input type="number" value={trimEnd} onChange={(e) => setTrimEnd(parseFloat(e.target.value))} step="0.1" />s</label>
              <button onClick={applyTrim} disabled={loading}>Apply Trim</button>
            </div>
          </div>

          {/* Speed Tool */}
          <div className="tool-section">
            <h3>⚡ Speed Control</h3>
            <div className="speed-controls">
              <label>Speed: {speed}x</label>
              <input
                type="range"
                min="0.25"
                max="2"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                step="0.25"
              />
              <button onClick={applySpeedChange} disabled={loading}>Apply Speed</button>
            </div>
          </div>

          {/* Filter Tools */}
          <div className="tool-section">
            <h3>🎨 Video Filters</h3>
            <div className="filter-controls">
              <label>Brightness: <input type="range" min="-1" max="1" value={brightness} onChange={(e) => setBrightness(parseFloat(e.target.value))} step="0.1" /></label>
              <label>Contrast: <input type="range" min="0" max="2" value={contrast} onChange={(e) => setContrast(parseFloat(e.target.value))} step="0.1" /></label>
              <label>Saturation: <input type="range" min="0" max="2" value={saturation} onChange={(e) => setSaturation(parseFloat(e.target.value))} step="0.1" /></label>
              <button onClick={applyFilters} disabled={loading}>Apply Filters</button>
            </div>
          </div>

          {/* Text Overlay Tool */}
          <div className="tool-section">
            <TextOverlayEditor
              overlays={textOverlays}
              onOverlaysChange={setTextOverlays}
              currentTime={currentTime}
              videoDuration={duration}
            />
            {textOverlays.length > 0 && (
              <button
                onClick={applyTextOverlays}
                disabled={loading}
                className="apply-text-btn"
              >
                Apply All Text Overlays
              </button>
            )}
          </div>

          {/* Background Music Tool */}
          <div className="tool-section">
            <MusicSelector
              onMusicSelect={setBackgroundMusic}
              selectedMusic={backgroundMusic}
              volume={musicVolume}
              onVolumeChange={setMusicVolume}
            />
            {backgroundMusic && (
              <button
                onClick={() => addBackgroundMusic(backgroundMusic)}
                disabled={loading}
                className="apply-music-btn"
              >
                Apply Background Music
              </button>
            )}
          </div>

          {/* Captions Tool */}
          <div className="tool-section">
            <h3>📋 Video Captions</h3>
            <button onClick={addCaption} className="add-caption-btn">
              Add Caption at Current Time
            </button>

            <CaptionStyleEditor
              style={captionStyle}
              onStyleChange={setCaptionStyle}
              onApply={applyCaptions}
            />

            {captions.length > 0 && (
              <div className="captions-section">
                <h4>Captions ({captions.length})</h4>
                <div className="captions-list">
                  {captions.map((caption, index) => (
                    <div key={index} className="caption-item">
                      <div className="caption-timing">
                        {caption.startTime.toFixed(1)}s - {caption.endTime.toFixed(1)}s
                      </div>
                      <textarea
                        value={caption.text}
                        onChange={(e) => {
                          const updated = [...captions];
                          updated[index].text = e.target.value;
                          setCaptions(updated);
                        }}
                        rows="2"
                      />
                      <button
                        onClick={() => {
                          const updated = captions.filter((_, i) => i !== index);
                          setCaptions(updated);
                        }}
                        className="delete-caption"
                      >
                        🗑️
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Image & Sticker Overlay Tool */}
          <div className="tool-section">
            <ImageOverlayEditor
              overlays={imageOverlays}
              onOverlaysChange={setImageOverlays}
              currentTime={currentTime}
              videoDuration={duration}
              videoDimensions={videoDimensions}
            />
            {imageOverlays.length > 0 && (
              <button
                onClick={applyImageOverlays}
                disabled={loading}
                className="apply-images-btn"
              >
                Apply Image Overlays
              </button>
            )}
          </div>

          {/* Voice Hooks */}
          <div className="tool-section">
            <VoiceHookSelector
              onVoiceHookSelect={setSelectedVoiceHook}
              selectedVoiceHook={selectedVoiceHook}
              startTime={voiceHookStartTime}
              onStartTimeChange={setVoiceHookStartTime}
            />
            {selectedVoiceHook && (
              <button
                onClick={applyVoiceHook}
                disabled={loading}
                className="apply-voice-btn"
              >
                Apply Voice Hook
              </button>
            )}
          </div>

          {/* Custom Asset Uploader */}
          <div className="tool-section">
            <h3>📤 Upload Custom Assets</h3>
            <div className="asset-upload-tabs">
              <CustomAssetUploader
                type="images"
                onAssetUploaded={handleAssetUploaded}
              />
              <CustomAssetUploader
                type="music"
                onAssetUploaded={handleAssetUploaded}
              />
              <CustomAssetUploader
                type="stickers"
                onAssetUploaded={handleAssetUploaded}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdvancedVideoEditor;
