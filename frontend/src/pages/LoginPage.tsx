import React, { useState } from 'react';
import { API_CONFIG } from '../config';

interface LoginPageProps {
  onLogin: (token: string, role: string) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [requires2fa, setRequires2fa] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`${API_CONFIG.NAUTILUS_API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: username.trim(),
          password,
          totp_code: totpCode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || 'Login failed. Check your credentials.');
        return;
      }

      if (data.requires_2fa) {
        setRequires2fa(true);
        setError('');
        return;
      }

      if (data.access_token) {
        onLogin(data.access_token, data.role ?? 'trader');
      } else {
        setError('Unexpected response from server.');
      }
    } catch {
      setError('Connection failed. Make sure the backend server is running.');
    } finally {
      setLoading(false);
    }
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
          {!requires2fa ? (
            <>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
                  placeholder="Enter your username..."
                  autoComplete="username"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900"
                  placeholder="Enter your password..."
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Two-Factor Authentication Code
              </label>
              <input
                type="text"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none text-gray-900 text-center text-2xl tracking-widest font-mono"
                placeholder="000000"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
              />
              <p className="text-xs text-gray-400 mt-2 text-center">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>
          )}

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
            {loading ? 'Signing in...' : requires2fa ? 'Verify Code' : 'Sign In'}
          </button>

          {requires2fa && (
            <button
              type="button"
              onClick={() => { setRequires2fa(false); setTotpCode(''); setError(''); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              ← Back to login
            </button>
          )}
        </form>

        <div className="mt-6 pt-6 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400">
            Server: <span className="font-mono">{API_CONFIG.NAUTILUS_API_URL}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
