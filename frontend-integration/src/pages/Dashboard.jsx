import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import TwoFactorSetup from '../components/Auth/TwoFactorSetup';
import SecurityDashboard from '../components/Auth/SecurityDashboard';
import VoiceHookSelector from '../components/VideoEditor/VoiceHookSelector';
import VideoEditorDashboard from '../components/VideoEditor/VideoEditorDashboard';
import AnalyticsDashboard from '../components/VideoEditor/AnalyticsDashboard';
import ContentLibrary from '../components/VideoEditor/ContentLibrary';

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [activeView, setActiveView] = useState('editor'); // editor, library, analytics

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🎬 Click Video Editor Platform</h1>
        <nav className="dashboard-nav">
          <button
            className={activeView === 'editor' ? 'active' : ''}
            onClick={() => setActiveView('editor')}
          >
            🎬 Editor
          </button>
          <button
            className={activeView === 'library' ? 'active' : ''}
            onClick={() => setActiveView('library')}
          >
            📚 Library
          </button>
          <Link to="/profile">👤 Profile</Link>
          <Link to="#analytics">📊 Analytics</Link>
          <button onClick={handleLogout}>🚪 Logout</button>
        </nav>
      </header>

      <main className="dashboard-content">
        <div className="welcome-section">
          <h2>Welcome back, {user?.name || user?.first_name}! 🎬</h2>
          <p>Create professional videos with AI-powered editing, voice hooks, and manual controls.</p>
        </div>

        <div className="dashboard-content-area">
          {activeView === 'editor' && (
            <div className="dashboard-grid">
              {/* Main Video Editor - Full Width */}
              <div className="dashboard-card full-width">
                <h3>🎬 Video Editor Studio</h3>
                <p className="card-description">Professional video editing with AI automation, manual controls, and custom asset uploads</p>
                <VideoEditorDashboard />
              </div>

              {/* Voice Hooks - Secondary Feature */}
              <div className="dashboard-card">
                <h3>🎤 Voice Hooks Studio</h3>
                <p className="card-description">Create engaging voice hooks with AI-powered suggestions and professional audio tools</p>
                <VoiceHookSelector />
              </div>
            </div>
          )}

          {activeView === 'library' && (
            <ContentLibrary />
          )}

          {activeView === 'analytics' && (
            <AnalyticsDashboard />
          )}

          {/* Always visible cards - Security & Account */}
          <div className="dashboard-grid">
            <div className="dashboard-card">
              <h3>🔐 Security Settings</h3>
              <p className="card-description">Protect your account with advanced security features</p>
              <TwoFactorSetup />
            </div>

            <div className="dashboard-card">
              <h3>🛡️ Security Dashboard</h3>
              <p className="card-description">Monitor your account activity and security status</p>
              <SecurityDashboard />
            </div>

            <div className="dashboard-card">
              <h3>👤 Account Overview</h3>
              <p className="card-description">Your account information and membership details</p>
              <div className="account-info">
                <p><strong>Email:</strong> <span>{user?.email}</span></p>
                <p><strong>Name:</strong> <span>{user?.name || user?.first_name}</span></p>
                <p><strong>Email Verified:</strong> <span>{user?.emailVerified ? '✅ Verified' : '❌ Unverified'}</span></p>
                <p><strong>Member Since:</strong> <span>{user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</span></p>
              </div>
            </div>

            <div className="dashboard-card">
              <h3>🚀 Quick Actions</h3>
              <p className="card-description">Access common features and settings</p>
              <div className="quick-actions">
                <Link to="/profile" className="action-btn">👤 Update Profile</Link>
                <button className="action-btn secondary" onClick={() => setActiveView('analytics')}>📊 View Analytics</button>
                <button className="action-btn secondary" onClick={() => setActiveView('library')}>🎬 Manage Content</button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
