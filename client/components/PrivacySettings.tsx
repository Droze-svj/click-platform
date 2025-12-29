'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Shield, Download, Trash2, AlertTriangle } from 'lucide-react';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorDisplay from './ErrorDisplay';

interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  marketing: boolean;
  cookies: 'essential' | 'all' | 'none';
}

export default function PrivacySettings() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    dataSharing: false,
    analytics: true,
    marketing: false,
    cookies: 'essential',
  });
  const [error, setError] = useState<Error | null>(null);
  const { handleError } = useErrorHandler();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/privacy/settings', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (err) {
      const apiError = handleError(err);
      setError(apiError);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<PrivacySettings>) => {
    setLoading(true);
    try {
      const response = await fetch('/api/privacy/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(newSettings),
      });
      const data = await response.json();
      if (data.success) {
        setSettings(data.data);
      }
    } catch (err) {
      const apiError = handleError(err);
      setError(apiError);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const response = await fetch('/api/privacy/export', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `user-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      handleError(err);
    }
  };

  const handleAnonymize = async () => {
    if (!confirm('Are you sure you want to anonymize your data? This action cannot be undone.')) {
      return;
    }

    if (prompt('Type "ANONYMIZE" to confirm:') !== 'ANONYMIZE') {
      return;
    }

    try {
      const response = await fetch('/api/privacy/anonymize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ confirm: 'ANONYMIZE' }),
      });
      const data = await response.json();
      if (data.success) {
        alert('Your data has been anonymized.');
        window.location.href = '/login';
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete all your data? This action cannot be undone.')) {
      return;
    }

    if (prompt('Type "DELETE" to confirm:') !== 'DELETE') {
      return;
    }

    try {
      const response = await fetch('/api/privacy/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ confirm: 'DELETE' }),
      });
      const data = await response.json();
      if (data.success) {
        alert('Your data has been deleted.');
        window.location.href = '/';
      }
    } catch (err) {
      handleError(err);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Privacy Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Data Sharing */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Data Sharing</h3>
              <p className="text-sm text-gray-500">Allow sharing of anonymized data for research</p>
            </div>
            <Switch
              checked={settings.dataSharing}
              onCheckedChange={(checked) => updateSettings({ dataSharing: checked })}
            />
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Analytics</h3>
              <p className="text-sm text-gray-500">Help us improve by sharing usage analytics</p>
            </div>
            <Switch
              checked={settings.analytics}
              onCheckedChange={(checked) => updateSettings({ analytics: checked })}
            />
          </div>

          {/* Marketing */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">Marketing Communications</h3>
              <p className="text-sm text-gray-500">Receive marketing emails and updates</p>
            </div>
            <Switch
              checked={settings.marketing}
              onCheckedChange={(checked) => updateSettings({ marketing: checked })}
            />
          </div>

          {/* Cookies */}
          <div>
            <h3 className="font-medium mb-2">Cookie Preferences</h3>
            <select
              value={settings.cookies}
              onChange={(e) => updateSettings({ cookies: e.target.value as any })}
              className="w-full p-2 border rounded"
            >
              <option value="essential">Essential Only</option>
              <option value="all">All Cookies</option>
              <option value="none">No Cookies</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* GDPR Actions */}
      <Card>
        <CardHeader>
          <CardTitle>GDPR Rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Data Portability</h3>
            <p className="text-sm text-gray-500 mb-2">
              Download all your data in JSON format
            </p>
            <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              Export My Data
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2 flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              Anonymize Data
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              Anonymize your personal data while keeping your account
            </p>
            <Button onClick={handleAnonymize} variant="outline" className="text-yellow-600">
              Anonymize My Data
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2 flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              Delete Account
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              Permanently delete all your data and account (Right to be forgotten)
            </p>
            <Button onClick={handleDelete} variant="outline" className="text-red-600">
              Delete My Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





