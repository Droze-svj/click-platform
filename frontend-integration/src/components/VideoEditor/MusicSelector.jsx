import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const MusicSelector = ({ onMusicSelect, selectedMusic, volume, onVolumeChange }) => {
  const { apiRequest } = useAuth();
  const [availableTracks, setAvailableTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [playingTrack, setPlayingTrack] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('all');
  const audioRef = useRef(null);

  useEffect(() => {
    loadMusicTracks();
  }, []);

  const loadMusicTracks = async () => {
    try {
      const { data } = await apiRequest('/video/manual-editing/music-tracks');
      if (data.success) {
        setAvailableTracks(data.data.tracks);
      }
    } catch (error) {
      console.error('Failed to load music tracks:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTracks = availableTracks.filter(track => {
    const matchesSearch = track.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesGenre = selectedGenre === 'all' || track.genre === selectedGenre;
    return matchesSearch && matchesGenre;
  });

  const genres = ['all', ...new Set(availableTracks.map(track => track.genre))];

  const playPreview = async (track) => {
    if (playingTrack === track.id) {
      // Stop playing
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingTrack(null);
    } else {
      // Start playing new track
      try {
        if (audioRef.current) {
          audioRef.current.pause();
        }

        // Get track preview URL
        const { data } = await apiRequest(`/video/manual-editing/music-track/${track.id}`);
        if (data.success) {
          audioRef.current = new Audio(data.data.url);
          audioRef.current.volume = volume;
          audioRef.current.play();
          setPlayingTrack(track.id);

          // Auto-stop after 30 seconds
          setTimeout(() => {
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
              setPlayingTrack(null);
            }
          }, 30000);
        }
      } catch (error) {
        console.error('Failed to play track preview:', error);
      }
    }
  };

  const handleTrackSelect = (track) => {
    onMusicSelect(track);
  };

  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="music-selector loading">
        <div className="loading-spinner">Loading music tracks...</div>
      </div>
    );
  }

  return (
    <div className="music-selector">
      <h3>🎵 Background Music</h3>

      {/* Search and Filter */}
      <div className="music-controls">
        <div className="search-bar">
          <input
            type="text"
            placeholder="Search music..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="genre-filter">
          <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
            {genres.map(genre => (
              <option key={genre} value={genre}>
                {genre === 'all' ? 'All Genres' : genre}
              </option>
            ))}
          </select>
        </div>

        <div className="volume-control">
          <label>Volume: {Math.round(volume * 100)}%</label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
          />
        </div>
      </div>

      {/* Selected Track Display */}
      {selectedMusic && (
        <div className="selected-track">
          <h4>Selected Music:</h4>
          <div className="track-info">
            <span className="track-name">{selectedMusic.name}</span>
            <span className="track-meta">{selectedMusic.genre} • {formatDuration(selectedMusic.duration)}</span>
            <button onClick={() => onMusicSelect(null)} className="remove-btn">Remove</button>
          </div>
        </div>
      )}

      {/* Music Library */}
      <div className="music-library">
        <h4>Music Library ({filteredTracks.length} tracks)</h4>

        {filteredTracks.length === 0 ? (
          <div className="no-tracks">No tracks found matching your criteria</div>
        ) : (
          <div className="tracks-grid">
            {filteredTracks.map(track => (
              <div
                key={track.id}
                className={`track-card ${selectedMusic?.id === track.id ? 'selected' : ''}`}
                onClick={() => handleTrackSelect(track)}
              >
                <div className="track-header">
                  <h5>{track.name}</h5>
                  <button
                    className={`play-btn ${playingTrack === track.id ? 'playing' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      playPreview(track);
                    }}
                  >
                    {playingTrack === track.id ? '⏸️' : '▶️'}
                  </button>
                </div>

                <div className="track-meta">
                  <span className="genre">{track.genre}</span>
                  <span className="duration">{formatDuration(track.duration)}</span>
                </div>

                <div className="track-waveform">
                  {/* Placeholder for waveform visualization */}
                  <div className="waveform-placeholder">
                    {Array.from({ length: 20 }, (_, i) => (
                      <div
                        key={i}
                        className="waveform-bar"
                        style={{
                          height: `${Math.random() * 20 + 5}px`,
                          animationDelay: `${i * 0.1}s`
                        }}
                      />
                    ))}
                  </div>
                </div>

                {selectedMusic?.id === track.id && (
                  <div className="selection-indicator">✓ Selected</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Custom Music */}
      <div className="custom-upload">
        <h4>Upload Custom Music</h4>
        <p>Upload your own music files (MP3, WAV, M4A)</p>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) {
              // Handle custom music upload
              const customTrack = {
                id: 'custom',
                name: file.name,
                genre: 'Custom',
                duration: 0, // Would need to calculate
                file: file
              };
              onMusicSelect(customTrack);
            }
          }}
        />
      </div>
    </div>
  );
};

export default MusicSelector;





