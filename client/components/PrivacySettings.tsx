'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Shield, Download, Trash2, AlertTriangle } from 'lucide-react';
import { useErrorHandler } from '../hooks/useErrorHandler';
import ErrorDisplay from './ErrorDisplay';
import { useTranslation } from '@/hooks/useTranslation';

interface PrivacySettings {
  dataSharing: boolean;
  analytics: boolean;
  marketing: boolean;
  cookies: 'essential' | 'all' | 'none';
}

export default function PrivacySettings() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<PrivacySettings>({
    dataSharing: false,
    analytics: true,
    marketing: false,
    cookies: 'essential',
  });
  const [error, setError] = useState<Error | null>(null);
  const { handleError } = useErrorHandler();

  const fetchSettings = useCallback(async () => {
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
      const errorObj = new Error(apiError.message);
      (errorObj as any).code = apiError.code;
      setError(errorObj);
    } finally {
      setLoading(false);
    }
  }, [handleError]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

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
      const errorObj = new Error(apiError.message);
      (errorObj as any).code = apiError.code;
      setError(errorObj);
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
    if (!confirm(t('privacySettings.confirmAnonymize'))) {
      return;
    }

    if (prompt(t('privacySettings.promptAnonymize')) !== 'ANONYMIZE') {
      return;
    }

    try {
      const response = await fetch('/api/privacy/anonymize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        alert(t('privacySettings.dataAnonymized'));
        window.location.href = '/login';
      }
    } catch (err) {
      handleError(err);
    }
  };

  const handleDelete = async () => {
    if (!confirm(t('privacySettings.confirmDelete'))) {
      return;
    }

    if (prompt(t('privacySettings.promptDelete')) !== 'DELETE') {
      return;
    }

    try {
      const response = await fetch('/api/privacy/delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        alert(t('privacySettings.dataDeleted'));
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
            {t('privacySettings.privacySettings')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && <ErrorDisplay error={error} onDismiss={() => setError(null)} />}

          {/* Data Sharing */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('privacySettings.dataSharing')}</h3>
              <p className="text-sm text-gray-500">{t('privacySettings.dataSharingDesc')}</p>
            </div>
            <Switch
              checked={settings.dataSharing}
              onCheckedChange={(checked) => updateSettings({ dataSharing: checked })}
            />
          </div>

          {/* Analytics */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('privacySettings.analytics')}</h3>
              <p className="text-sm text-gray-500">{t('privacySettings.analyticsDesc')}</p>
            </div>
            <Switch
              checked={settings.analytics}
              onCheckedChange={(checked) => updateSettings({ analytics: checked })}
            />
          </div>

          {/* Marketing */}
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{t('privacySettings.marketingCommunications')}</h3>
              <p className="text-sm text-gray-500">{t('privacySettings.marketingDesc')}</p>
            </div>
            <Switch
              checked={settings.marketing}
              onCheckedChange={(checked) => updateSettings({ marketing: checked })}
            />
          </div>

          {/* Cookies */}
          <div>
            <h3 className="font-medium mb-2">{t('privacySettings.cookiePreferences')}</h3>
            <select
              value={settings.cookies}
              onChange={(e) => updateSettings({ cookies: e.target.value as any })}
              title={t('privacySettings.selectCookiePreferences')}
              aria-label={t('privacySettings.selectCookiePreferences')}
              className="w-full p-2 border rounded"
            >
              <option value="essential">{t('privacySettings.essentialOnly')}</option>
              <option value="all">{t('privacySettings.allCookies')}</option>
              <option value="none">{t('privacySettings.noCookies')}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* GDPR Actions */}
      <Card>
        <CardHeader>
          <CardTitle>{t('privacySettings.gdprRights')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">{t('privacySettings.dataPortability')}</h3>
            <p className="text-sm text-gray-500 mb-2">
              {t('privacySettings.dataPortabilityDesc')}
            </p>
            <Button onClick={handleExport} variant="outline" className="flex items-center gap-2">
              <Download className="h-4 w-4" />
              {t('privacySettings.exportMyData')}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2 flex items-center gap-2 text-yellow-600">
              <AlertTriangle className="h-4 w-4" />
              {t('privacySettings.anonymizeData')}
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              {t('privacySettings.anonymizeDataDesc')}
            </p>
            <Button onClick={handleAnonymize} variant="outline" className="text-yellow-600">
              {t('privacySettings.anonymizeMyData')}
            </Button>
          </div>

          <div className="border-t pt-4">
            <h3 className="font-medium mb-2 flex items-center gap-2 text-red-600">
              <Trash2 className="h-4 w-4" />
              {t('privacySettings.deleteAccount')}
            </h3>
            <p className="text-sm text-gray-500 mb-2">
              {t('privacySettings.deleteAccountDesc')}
            </p>
            <Button onClick={handleDelete} variant="outline" className="text-red-600">
              {t('privacySettings.deleteMyAccount')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}





