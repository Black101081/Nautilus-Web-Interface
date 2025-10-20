import React, { useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { Save, RotateCcw, Download, Upload, Shield, Bell, Palette, Database } from 'lucide-react';
import { useNotification } from '@/contexts/NotificationContext';

/**
 * Settings Page
 * Page 6 of 6 - System configuration and preferences
 */

const SettingsPage: React.FC = () => {
  const { success, error, warning, info } = useNotification();

  // General Settings
  const [systemName, setSystemName] = useState('Nautilus Trader');
  const [timezone, setTimezone] = useState('UTC');
  const [logLevel, setLogLevel] = useState('info');

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [slackNotifications, setSlackNotifications] = useState(false);
  const [alertThreshold, setAlertThreshold] = useState('medium');

  // Security Settings
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [apiKeyRotation, setApiKeyRotation] = useState('90');

  // Performance Settings
  const [cacheEnabled, setCacheEnabled] = useState(true);
  const [maxConnections, setMaxConnections] = useState('100');
  const [requestTimeout, setRequestTimeout] = useState('30');

  // Handler functions
  const handleSaveGeneral = () => {
    info('Saving general settings...');
    setTimeout(() => success('General settings saved successfully'), 1000);
  };

  const handleResetGeneral = () => {
    warning('Resetting general settings to defaults...');
    setSystemName('Nautilus Trader');
    setTimezone('UTC');
    setLogLevel('info');
    setTimeout(() => info('General settings reset to defaults'), 500);
  };

  const handleSaveNotifications = () => {
    info('Saving notification settings...');
    setTimeout(() => success('Notification settings saved successfully'), 1000);
  };

  const handleResetNotifications = () => {
    warning('Resetting notification settings to defaults...');
    setEmailNotifications(true);
    setSlackNotifications(false);
    setAlertThreshold('medium');
    setTimeout(() => info('Notification settings reset to defaults'), 500);
  };

  const handleSaveSecurity = () => {
    info('Saving security settings...');
    setTimeout(() => success('Security settings saved successfully'), 1000);
  };

  const handleResetSecurity = () => {
    warning('Resetting security settings to defaults...');
    setTwoFactorAuth(false);
    setSessionTimeout('30');
    setApiKeyRotation('90');
    setTimeout(() => info('Security settings reset to defaults'), 500);
  };

  const handleSavePerformance = () => {
    info('Saving performance settings...');
    setTimeout(() => success('Performance settings saved successfully'), 1000);
  };

  const handleResetPerformance = () => {
    warning('Resetting performance settings to defaults...');
    setCacheEnabled(true);
    setMaxConnections('100');
    setRequestTimeout('30');
    setTimeout(() => info('Performance settings reset to defaults'), 500);
  };

  const handleExportSettings = () => {
    info('Exporting configuration...');
    setTimeout(() => success('Configuration exported to config.json'), 1500);
  };

  const handleImportSettings = () => {
    info('Opening file selector...');
    // In real implementation, this would open file dialog
    setTimeout(() => success('Configuration imported successfully'), 1500);
  };

  const handleResetAll = () => {
    warning('Resetting ALL settings to factory defaults...');
    setTimeout(() => {
      handleResetGeneral();
      handleResetNotifications();
      handleResetSecurity();
      handleResetPerformance();
      success('All settings reset to factory defaults');
    }, 1000);
  };

  const handleSaveAll = () => {
    info('Saving all settings...');
    setTimeout(() => success('All settings saved successfully'), 1500);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <AdminSidebar />
      
      <main className="flex-1 ml-64 p-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              System Settings
            </h1>
            <p className="text-gray-600">
              Configure system preferences and behavior
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleExportSettings}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              <Download className="h-5 w-5" />
              Export
            </button>
            <button
              onClick={handleImportSettings}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg font-medium transition-colors"
            >
              <Upload className="h-5 w-5" />
              Import
            </button>
          </div>
        </div>

        {/* General Settings */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="h-5 w-5 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">General Settings</h2>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Name
              </label>
              <input
                type="text"
                value={systemName}
                onChange={(e) => setSystemName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New York</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
                <option value="Asia/Singapore">Asia/Singapore</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Log Level
              </label>
              <select
                value={logLevel}
                onChange={(e) => setLogLevel(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="debug">Debug</option>
                <option value="info">Info</option>
                <option value="warning">Warning</option>
                <option value="error">Error</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveGeneral}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={handleResetGeneral}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Notification Settings */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-yellow-600" />
            <h2 className="text-xl font-semibold text-gray-900">Notification Settings</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive alerts via email</p>
              </div>
              <button
                onClick={() => setEmailNotifications(!emailNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  emailNotifications ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    emailNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Slack Notifications</p>
                <p className="text-sm text-gray-600">Send alerts to Slack channel</p>
              </div>
              <button
                onClick={() => setSlackNotifications(!slackNotifications)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  slackNotifications ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    slackNotifications ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Alert Threshold
              </label>
              <select
                value={alertThreshold}
                onChange={(e) => setAlertThreshold(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="low">Low - All alerts</option>
                <option value="medium">Medium - Important alerts only</option>
                <option value="high">High - Critical alerts only</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveNotifications}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={handleResetNotifications}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Security Settings */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-5 w-5 text-green-600" />
            <h2 className="text-xl font-semibold text-gray-900">Security Settings</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Two-Factor Authentication</p>
                <p className="text-sm text-gray-600">Require 2FA for admin access</p>
              </div>
              <button
                onClick={() => setTwoFactorAuth(!twoFactorAuth)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  twoFactorAuth ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    twoFactorAuth ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Session Timeout (minutes)
              </label>
              <input
                type="number"
                value={sessionTimeout}
                onChange={(e) => setSessionTimeout(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                API Key Rotation (days)
              </label>
              <input
                type="number"
                value={apiKeyRotation}
                onChange={(e) => setApiKeyRotation(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSaveSecurity}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={handleResetSecurity}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Performance Settings */}
        <div className="mb-6 bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <Database className="h-5 w-5 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">Performance Settings</h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Enable Caching</p>
                <p className="text-sm text-gray-600">Cache frequently accessed data</p>
              </div>
              <button
                onClick={() => setCacheEnabled(!cacheEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  cacheEnabled ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    cacheEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Concurrent Connections
              </label>
              <input
                type="number"
                value={maxConnections}
                onChange={(e) => setMaxConnections(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Request Timeout (seconds)
              </label>
              <input
                type="number"
                value={requestTimeout}
                onChange={(e) => setRequestTimeout(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleSavePerformance}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Save className="h-4 w-4" />
              Save
            </button>
            <button
              onClick={handleResetPerformance}
              className="flex items-center gap-2 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-4 w-4" />
              Reset
            </button>
          </div>
        </div>

        {/* Global Actions */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Global Actions
          </h2>
          <div className="flex gap-3">
            <button
              onClick={handleSaveAll}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              <Save className="h-5 w-5" />
              Save All Settings
            </button>
            <button
              onClick={handleResetAll}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              <RotateCcw className="h-5 w-5" />
              Reset All to Defaults
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPage;

