import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const Profile = () => {
  const { user, apiRequest } = useAuth();
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user?.first_name || '',
    lastName: user?.last_name || '',
    bio: user?.bio || '',
    website: user?.website || '',
    location: user?.location || ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data } = await apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(formData)
    });

    if (data.success) {
      setMessage('Profile updated successfully!');
      setEditing(false);
      // Refresh user data
      window.location.reload();
    } else {
      setMessage(data.error || 'Failed to update profile');
    }

    setLoading(false);
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const { data } = await apiRequest('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      })
    });

    if (data.success) {
      setMessage('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '' });
    } else {
      setMessage(data.error || 'Failed to change password');
    }

    setLoading(false);
  };

  const deactivateAccount = async () => {
    if (!window.confirm('Are you sure you want to deactivate your account? You can reactivate it later by logging back in.')) {
      return;
    }

    try {
      setLoading(true);
      const { data } = await apiRequest('/auth/deactivate', {
        method: 'POST'
      });

      if (data?.success) {
        alert('Account deactivated successfully. You will be logged out.');
        // Redirect to login or logout
        window.location.href = '/login';
      } else {
        alert('Failed to deactivate account. Please try again.');
      }
    } catch (error) {
      console.error('Deactivate account error:', error);
      alert('Failed to deactivate account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const deleteAccount = async () => {
    if (!window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone and all your data will be lost.')) {
      return;
    }

    const confirmation = window.prompt('Please type "DELETE" to confirm permanent account deletion:');
    if (confirmation !== 'DELETE') {
      alert('Account deletion cancelled.');
      return;
    }

    try {
      setLoading(true);
      const { data } = await apiRequest('/auth/delete', {
        method: 'DELETE'
      });

      if (data?.success) {
        alert('Account deleted successfully.');
        // Redirect to home
        window.location.href = '/';
      } else {
        alert('Failed to delete account. Please try again.');
      }
    } catch (error) {
      console.error('Delete account error:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="profile-page">
      <header className="page-header">
        <h1>Profile Settings</h1>
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>
      </header>

      <div className="profile-content">
        {/* Profile Information */}
        <div className="profile-card">
          <h2>Profile Information</h2>

          {!editing ? (
            <div className="profile-display">
              <div className="profile-field">
                <label>Name:</label>
                <span>{user?.name || `${user?.first_name} ${user?.last_name}`}</span>
              </div>
              <div className="profile-field">
                <label>Email:</label>
                <span>{user?.email}</span>
              </div>
              <div className="profile-field">
                <label>Bio:</label>
                <span>{user?.bio || 'Not set'}</span>
              </div>
              <div className="profile-field">
                <label>Website:</label>
                <span>{user?.website || 'Not set'}</span>
              </div>
              <div className="profile-field">
                <label>Location:</label>
                <span>{user?.location || 'Not set'}</span>
              </div>
              <button onClick={() => setEditing(true)} className="edit-btn">
                Edit Profile
              </button>
            </div>
          ) : (
            <form onSubmit={handleProfileUpdate} className="profile-edit">
              <div className="form-row">
                <div className="form-group">
                  <label>First Name:</label>
                  <input
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Last Name:</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Bio:</label>
                <textarea
                  value={formData.bio}
                  onChange={(e) => setFormData({...formData, bio: e.target.value})}
                  placeholder="Tell us about yourself..."
                  rows="3"
                />
              </div>

              <div className="form-group">
                <label>Website:</label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({...formData, website: e.target.value})}
                  placeholder="https://yourwebsite.com"
                />
              </div>

              <div className="form-group">
                <label>Location:</label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                  placeholder="City, Country"
                />
              </div>

              <div className="form-actions">
                <button type="submit" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="cancel-btn">
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Password Change */}
        <div className="profile-card">
          <h2>Change Password</h2>
          <form onSubmit={handlePasswordChange} className="password-form">
            <div className="form-group">
              <label>Current Password:</label>
              <input
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                required
              />
            </div>

            <div className="form-group">
              <label>New Password:</label>
              <input
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                required
              />
            </div>

            <button type="submit" disabled={loading}>
              {loading ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Account Actions */}
        <div className="profile-card danger-zone">
          <h2>⚠️ Account Actions</h2>
          <p>These actions cannot be undone. Please be certain.</p>

          <div className="account-actions">
            <button className="action-btn warning" onClick={deactivateAccount}>
              Deactivate Account
            </button>
            <button className="action-btn danger" onClick={deleteAccount}>
              Delete Account
            </button>
          </div>
        </div>

        {message && (
          <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
