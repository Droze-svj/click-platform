import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const EmailVerification = () => {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  const { apiRequest } = useAuth();

  const verifyEmail = useCallback(async (verificationToken) => {
    setLoading(true);
    const { data } = await apiRequest('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: verificationToken })
    });

    if (data.success) {
      setMessage('Email verified successfully! You can now log in.');
      // Redirect to login page or auto-login
      setTimeout(() => {
        window.location.href = '/login';
      }, 3000);
    } else {
      setMessage(data.error || 'Verification failed');
    }
    setLoading(false);
  }, [apiRequest]);

  useEffect(() => {
    // Check URL for verification token
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      setToken(urlToken);
      verifyEmail(urlToken);
    }
  }, [verifyEmail]);

  const resendVerification = async () => {
    if (!email) {
      setMessage('Please enter your email address');
      return;
    }

    setLoading(true);
    const { data } = await apiRequest('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email })
    });

    if (data.success) {
      setMessage('Verification email sent successfully!');
    } else {
      setMessage(data.error || 'Failed to send verification email');
    }
    setLoading(false);
  };

  return (
    <div className="email-verification">
      <h2>📧 Email Verification</h2>

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}

      {!token && (
        <div className="resend-section">
          <p>Didn't receive the verification email?</p>
          <div className="form-group">
            <label>Enter your email to resend:</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
            />
          </div>
          <button onClick={resendVerification} disabled={loading}>
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>
        </div>
      )}

      {token && (
        <div className="verification-status">
          {loading ? (
            <p>Verifying your email...</p>
          ) : (
            <p>Processing verification...</p>
          )}
        </div>
      )}
    </div>
  );
};

export default EmailVerification;
