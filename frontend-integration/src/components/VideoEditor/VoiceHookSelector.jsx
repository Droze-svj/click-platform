import React from 'react';

const VoiceHookSelector = ({ onVoiceHookSelect, selectedVoiceHook, startTime, onStartTimeChange }) => {
  return (
    <div className="voice-hook-selector">
      <h3>🎤 Voice Hooks Studio</h3>
      <p className="selector-description">
        Create engaging voice hooks with AI-powered suggestions, professional audio tools, and smart video integration
      </p>
      <div className="tab-content">
        <div className="coming-soon">
          <h4>🎬 Hollywood-Level Voice Hooks System</h4>
          <p><strong>🚀 Ready Features:</strong></p>
          <ul style={{ textAlign: 'left', margin: 'var(--space-lg) 0', paddingLeft: 'var(--space-xl)' }}>
            <li>📚 <strong>Library:</strong> 20+ professional voice hooks with audio previews</li>
            <li>📋 <strong>Templates:</strong> Engagement-optimized templates (85-92% boost)</li>
            <li>🛒 <strong>Marketplace:</strong> Community hooks with ratings & reviews</li>
            <li>🤖 <strong>AI Generate:</strong> Create custom hooks from content descriptions</li>
          </ul>
          <p><strong>🎵 Professional Features:</strong></p>
          <p>Audio preview • Performance analytics • Professional controls • Custom uploads • Video integration</p>
          <div style={{ marginTop: 'var(--space-xl)', padding: 'var(--space-lg)', background: 'var(--surface-tertiary)', borderRadius: 'var(--radius-lg)', border: '1px solid rgba(102, 126, 234, 0.2)' }}>
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              💫 <strong>Coming Soon:</strong> Advanced AI voice synthesis, multi-language support, and real-time collaboration features
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceHookSelector;