import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const RegisterForm = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: ''
  });
  const [passwordStrength, setPasswordStrength] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { register, apiRequest } = useAuth();

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });

    // Check password strength
    if (e.target.name === 'password') {
      checkPasswordStrength(e.target.value);
    }
  };

  const checkPasswordStrength = async (password) => {
    if (!password) {
      setPasswordStrength(null);
      return;
    }

    const { data } = await apiRequest('/auth/check-password-strength', {
      method: 'POST',
      body: JSON.stringify({ password })
    });

    if (data.success) {
      setPasswordStrength(data.data);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const result = await register(
      formData.email,
      formData.password,
      formData.firstName,
      formData.lastName
    );

    if (result.success) {
      setMessage('Registration successful! Please check your email to verify your account.');
    } else {
      setMessage(result.error || 'Registration failed');
    }

    setLoading(false);
  };

  return (
    <div className="auth-form">
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>First Name:</label>
          <input
            type="text"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Last Name:</label>
          <input
            type="text"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Email:</label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
        </div>
        <div className="form-group">
          <label>Password:</label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          {passwordStrength && (
            <div className={`password-strength ${passwordStrength.level}`}>
              Strength: {passwordStrength.strength}/100 ({passwordStrength.level})
              {passwordStrength.errors && passwordStrength.errors.length > 0 && (
                <div className="errors">
                  {passwordStrength.errors.map((error, i) => (
                    <div key={i}>• {error}</div>
                  ))}
                </div>
              )}
              {passwordStrength.suggestions && passwordStrength.suggestions.length > 0 && (
                <div className="suggestions">
                  Suggestions: {passwordStrength.suggestions.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      {message && <div className={`message ${message.includes('successful') ? 'success' : 'error'}`}>{message}</div>}
    </div>
  );
};

export default RegisterForm;





