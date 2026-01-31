import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const LoginForm = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [requires2FA, setRequires2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { login, verify2FA } = useAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = await login(email, password);

    if (result.requires2FA) {
      setRequires2FA(true);
      setTempToken(result.tempToken);
      setMessage('Enter your 2FA code');
    } else if (result.success) {
      setMessage('Login successful!');
      // Redirect to dashboard after successful login
      setTimeout(() => navigate('/dashboard'), 1000);
    } else {
      setMessage(result.error || 'Login failed');
    }

    setLoading(false);
  };

  const handle2FAVerification = async (e) => {
    e.preventDefault();
    setLoading(true);

    const result = await verify2FA(twoFactorCode, tempToken);

    if (result.success) {
      setMessage('Login successful!');
      setRequires2FA(false);
      // Redirect to dashboard after successful 2FA verification
      setTimeout(() => navigate('/dashboard'), 1000);
    } else {
      setMessage(result.error || '2FA verification failed');
    }

    setLoading(false);
  };

  if (requires2FA) {
    return (
      <div className="auth-form">
        <h2>Enter 2FA Code</h2>
        <form onSubmit={handle2FAVerification}>
          <div className="form-group">
            <label>2FA Code:</label>
            <input
              type="text"
              value={twoFactorCode}
              onChange={(e) => setTwoFactorCode(e.target.value)}
              placeholder="000000"
              maxLength="6"
              required
            />
          </div>
          <button type="submit" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify'}
          </button>
        </form>
        {message && <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>{message}</div>}
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@example.com"
            required
          />
          <small style={{ color: '#666', fontSize: '12px' }}>
            Dev credentials: admin@example.com / admin123 or test@example.com / test123
          </small>
        </div>
        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="admin123"
            required
          />
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </form>
      {message && <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>{message}</div>}
    </div>
  );
};

export default LoginForm;
