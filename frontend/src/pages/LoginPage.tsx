import React, { useState } from 'react';
import { API_CONFIG } from '../config';

interface LoginPageProps {
  onLogin: (apiKey: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/health`, {
        headers: apiKey ? { 'X-API-Key': apiKey } : {},
      });

      if (res.ok) {
        localStorage.setItem('nautilus_api_key', apiKey);
        onLogin(apiKey);
      } else if (res.status === 401) {
        setError('Invalid API key. Please check and try again.');
      } else {
        setError('Could not connect to server. Check the API URL configuration.');
      }
    } catch {
      setError('Connection failed. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    localStorage.removeItem('nautilus_api_key');
    onLogin('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🐚</div>
          <h1 className="text-3xl font-bold text-gray-900">Nautilus Trader</h1>
          <p className="text-gray-500 mt-1">Web Interface</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
              placeholder="Enter your API key..."
              autoComplete="current-password"
            />
            <p className="text-xs text-gray-400 mt-1">
              Set on the server via the <code className="bg-gray-100 px-1 rounded">API_KEY</code> environment variable
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold transition-all disabled:opacity-50"
          >
            {loading ? 'Connecting...' : 'Connect'}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            onClick={handleSkip}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Continue without authentication →
          </button>
        </div>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Server: <span className="font-mono">{API_CONFIG.NAUTILUS_API_URL}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
