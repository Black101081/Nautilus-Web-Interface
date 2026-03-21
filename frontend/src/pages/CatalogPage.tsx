import React, { useState, useEffect, useRef } from 'react';
import api from '../lib/api';

interface Dataset {
  filename: string;
  format: string;
  size_bytes: number;
  modified: string;
}

const SYMBOLS = ['BTCUSDT','ETHUSDT','SOLUSDT','BNBUSDT','XRPUSDT','ADAUSDT','DOGEUSDT','AVAXUSDT'];
const INTERVALS = ['1m','5m','15m','1h','4h','1d','1w'];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export default function CatalogPage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [exportSymbol, setExportSymbol] = useState('BTCUSDT');
  const [exportInterval, setExportInterval] = useState('1h');
  const [exportLimit, setExportLimit] = useState(500);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const d = await api.get<{ datasets: Dataset[] }>('/api/catalog/datasets');
      setDatasets(d.datasets || []);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg('');
    const form = new FormData();
    form.append('file', file);
    const endpoint = file.name.endsWith('.parquet')
      ? '/api/catalog/import/parquet'
      : '/api/catalog/import/csv';
    try {
      const token = localStorage.getItem('nautilus_token');
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.detail || 'Upload failed');
      setImportMsg(`✅ ${result.message}`);
      await fetchDatasets();
    } catch (err: any) {
      setImportMsg(`❌ ${err.message}`);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = async (filename: string) => {
    if (!confirm(`Delete dataset "${filename}"?`)) return;
    setDeleting(filename);
    try {
      await api.delete(`/api/catalog/datasets/${filename}`);
      setDatasets(prev => prev.filter(d => d.filename !== filename));
    } catch (err: any) {
      alert(err.message || 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  const exportUrl = (format: 'csv' | 'parquet') =>
    `/api/catalog/export/${format}/${exportSymbol}?interval=${exportInterval}&limit=${exportLimit}`;

  return (
    <div className="p-6">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-1">🗄️ Data Catalog</h1>
            <p className="text-gray-500">Import and export OHLCV datasets (CSV / Parquet)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Export panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Export Market Data</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Symbol</label>
                <select value={exportSymbol} onChange={e => setExportSymbol(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  {SYMBOLS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Interval</label>
                  <select value={exportInterval} onChange={e => setExportInterval(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    {INTERVALS.map(iv => <option key={iv}>{iv}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Bars (max 1000)</label>
                  <input type="number" value={exportLimit} min={1} max={1000}
                    onChange={e => setExportLimit(Number(e.target.value))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div className="flex gap-3">
                <a href={exportUrl('csv')} target="_blank" rel="noreferrer"
                  className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold text-sm text-center">
                  ↓ Export CSV
                </a>
                <a href={exportUrl('parquet')} target="_blank" rel="noreferrer"
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm text-center">
                  ↓ Export Parquet
                </a>
              </div>
            </div>
          </div>

          {/* Import panel */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h2 className="font-bold text-gray-900 mb-4">Import Dataset</h2>
            <div className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors">
              <div className="text-4xl mb-3">📂</div>
              <p className="text-gray-500 text-sm mb-3">
                Drop a CSV or Parquet file here, or click to browse.
              </p>
              <p className="text-xs text-gray-400 mb-4">
                CSV: requires columns <code>time, open, high, low, close, volume</code><br />
                Parquet: any columnar format · Max 50 MB (CSV) / 200 MB (Parquet)
              </p>
              <input ref={fileRef} type="file" accept=".csv,.parquet"
                className="hidden" id="catalog-file-input"
                onChange={handleImport} />
              <label htmlFor="catalog-file-input"
                className={`px-6 py-2.5 bg-indigo-600 text-white rounded-lg cursor-pointer font-semibold text-sm
                  hover:bg-indigo-700 transition-colors ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
                {importing ? 'Uploading...' : 'Choose File'}
              </label>
            </div>
            {importMsg && (
              <div className={`mt-3 p-3 rounded-lg text-sm ${importMsg.startsWith('✅') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {importMsg}
              </div>
            )}
          </div>
        </div>

        {/* Dataset list */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
            <div>
              <h2 className="font-bold text-gray-900">Stored Datasets</h2>
              <p className="text-xs text-gray-400 mt-0.5">{datasets.length} files</p>
            </div>
            <button onClick={fetchDatasets} className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold">
              ⟳ Refresh
            </button>
          </div>

          {loading ? (
            <div className="p-8 text-center text-gray-400">Loading...</div>
          ) : datasets.length === 0 ? (
            <div className="p-12 text-center">
              <div className="text-4xl mb-3">🗄️</div>
              <div className="text-gray-400">No datasets yet. Export or import data above.</div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-6 py-3 text-left text-gray-600 font-semibold">Filename</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-semibold">Format</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Size</th>
                  <th className="px-4 py-3 text-right text-gray-600 font-semibold">Modified</th>
                  <th className="px-4 py-3 text-center text-gray-600 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {datasets.map(d => (
                  <tr key={d.filename} className="hover:bg-gray-50">
                    <td className="px-6 py-3 font-medium text-gray-900">{d.filename}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        d.format === 'csv' ? 'bg-green-100 text-green-700' :
                        d.format === 'parquet' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {d.format.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{formatBytes(d.size_bytes)}</td>
                    <td className="px-4 py-3 text-right text-gray-400 text-xs">
                      {new Date(d.modified).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDelete(d.filename)}
                        disabled={deleting === d.filename}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100 disabled:opacity-50"
                      >
                        {deleting === d.filename ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
    </div>
  );
}
