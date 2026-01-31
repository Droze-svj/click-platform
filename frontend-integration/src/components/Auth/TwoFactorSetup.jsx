import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';

const TwoFactorSetup = () => {
  const [twofaData, setTwofaData] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const { apiRequest } = useAuth();

  const setup2FA = async () => {
    setLoading(true);
    const { data } = await apiRequest('/auth/2fa/setup', {
      method: 'POST'
    });

    if (data.success) {
      setTwofaData(data.data);
    } else {
      setMessage(data.error || 'Failed to setup 2FA');
    }
    setLoading(false);
  };

  const enable2FA = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setMessage('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    const { data } = await apiRequest('/auth/2fa/enable', {
      method: 'POST',
      body: JSON.stringify({ token: verificationCode })
    });

    if (data.success) {
      setBackupCodes(data.data.backup_codes);
      setMessage('2FA enabled successfully! Save your backup codes.');
      setTwofaData(null);
    } else {
      setMessage(data.error || 'Failed to enable 2FA');
    }
    setLoading(false);
  };

  const disable2FA = async () => {
    if (!window.confirm('Are you sure you want to disable 2FA?')) return;

    setLoading(true);
    const { data } = await apiRequest('/auth/2fa/disable', {
      method: 'POST'
    });

    if (data.success) {
      setMessage('2FA disabled successfully');
      setTwofaData(null);
      setBackupCodes([]);
    } else {
      setMessage(data.error || 'Failed to disable 2FA');
    }
    setLoading(false);
  };

  const downloadBackupCodes = () => {
    const codes = backupCodes.join('\n');
    const blob = new Blob([codes], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="twofa-setup">
      <h3>Two-Factor Authentication</h3>

      {!twofaData && backupCodes.length === 0 && (
        <button onClick={setup2FA} disabled={loading}>
          {loading ? 'Setting up...' : 'Setup 2FA'}
        </button>
      )}

      {twofaData && (
        <div className="setup-instructions">
          <h4>Setup Instructions:</h4>
          <ol>
            <li>Install Google Authenticator or similar app</li>
            <li>Scan this QR code:</li>
          </ol>
          <div className="qr-code">
            <img src={twofaData.qrCode} alt="2FA QR Code" />
          </div>
          <p>Or enter this code manually: <code>{twofaData.secret}</code></p>

          <div className="form-group">
            <label>Enter 6-digit code from your app:</label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
              placeholder="000000"
              maxLength="6"
            />
          </div>

          <button onClick={enable2FA} disabled={loading}>
            {loading ? 'Enabling...' : 'Enable 2FA'}
          </button>
        </div>
      )}

      {backupCodes.length > 0 && (
        <div className="backup-codes">
          <h4>⚠️ Save Your Backup Codes</h4>
          <p>Store these codes in a safe place. Use them if you lose access to your authenticator app.</p>
          <div className="codes">
            {backupCodes.map((code, index) => (
              <code key={index}>{code}</code>
            ))}
          </div>
          <button onClick={downloadBackupCodes}>Download Codes</button>
          <button onClick={disable2FA} className="danger">Disable 2FA</button>
        </div>
      )}

      {message && (
        <div className={`message ${message.includes('success') ? 'success' : 'error'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default TwoFactorSetup;
