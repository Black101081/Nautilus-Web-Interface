import React, { useState } from 'react';
import { AdminSidebar } from '@/components/AdminSidebar';
import { StatusBadge } from '@/components/admin';
import { databaseService } from '@/services/databaseService';
import { useNotification } from '@/contexts/NotificationContext';
import logger from '@/utils/logger';
import { 
  Database,
  HardDrive,
  Zap,
  Download,
  Upload,
  Trash2,
  RefreshCw,
  BarChart3,
  FileText,
  Loader2,
} from 'lucide-react';

/**
 * Database Management Page
 * Dedicated page for managing Nautilus Core databases
 * - PostgreSQL Cache (State & Orders)
 * - Parquet Catalog (Market Data)
 * - Redis Cache (High-Speed)
 */

const DatabasePage: React.FC = () => {
  logger.component('DatabasePage', 'mounted');
  const [loading, setLoading] = useState<string | null>(null);
  const { success, error, info } = useNotification();

  // PostgreSQL Operations
  const handleBackupPostgreSQL = async () => {
    if (!window.confirm('Backup PostgreSQL database?\n\nThis will create a full backup of all tables.')) {
      return;
    }

    logger.interaction('BackupButton', 'clicked');
    setLoading('backup-pg');
    
    try {
      const result = await databaseService.backupPostgreSQL();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Backup operation failed');
    } finally {
      setLoading(null);
    }
  };

  const handleOptimizePostgreSQL = async () => {
    if (!window.confirm('Optimize PostgreSQL database?\n\nThis will vacuum and analyze all tables.')) {
      return;
    }

    setLoading('optimize-pg');
    
    try {
      const result = await databaseService.optimizePostgreSQL();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Optimization failed');
    } finally {
      setLoading(null);
    }
  };

  // Parquet Operations
  const handleExportParquet = async () => {
    if (!window.confirm('Export Parquet catalog?\n\nThis will export all market data files.')) {
      return;
    }

    setLoading('export-parquet');
    
    try {
      const result = await databaseService.exportParquet();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Export failed');
    } finally {
      setLoading(null);
    }
  };

  const handleCleanParquet = async () => {
    if (!window.confirm('Clean Parquet catalog?\n\nThis will remove old and unused data files.\n\nThis action cannot be undone!')) {
      return;
    }

    setLoading('clean-parquet');
    
    try {
      const result = await databaseService.cleanParquet();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Clean operation failed');
    } finally {
      setLoading(null);
    }
  };

  // Redis Operations
  const handleFlushRedis = async () => {
    if (!window.confirm('Flush Redis cache?\n\nThis will clear all cached data.\n\nThis action cannot be undone!')) {
      return;
    }

    setLoading('flush-redis');
    
    try {
      const result = await databaseService.flushRedis();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Flush operation failed');
    } finally {
      setLoading(null);
    }
  };

  const handleRedisStats = async () => {
    setLoading('stats-redis');
    
    try {
      const result = await databaseService.getRedisStats();
      if (result.success) {
        info(`Redis Statistics:\n\n${result.message}`);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Failed to get Redis stats');
    } finally {
      setLoading(null);
    }
  };

  // Maintenance Operations
  const handleFullBackup = async () => {
    if (!window.confirm('Create full system backup?\n\nThis will backup all databases (PostgreSQL + Parquet + Redis).')) {
      return;
    }

    setLoading('full-backup');
    
    try {
      const result = await databaseService.fullBackup();
      if (result.success) {
        success(result.message);
      } else {
        error(result.message);
      }
    } catch (err) {
      error('Full backup failed');
    } finally {
      setLoading(null);
    }
  };

  const handleViewTable = (tableName: string) => {
    info(`Viewing table: ${tableName}\n\nThis feature will open a table viewer in a future update.`);
  };

  return (
    <div className="flex h-screen bg-gray-900">
      <AdminSidebar />
      
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-white mb-2">Database Management</h1>
            <p className="text-gray-400">Manage Nautilus Core databases and storage systems</p>
          </div>

          {/* Database Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {/* PostgreSQL */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Database className="h-6 w-6 text-blue-400" />
                  <h3 className="text-lg font-semibold text-white">PostgreSQL Cache</h3>
                </div>
                <StatusBadge status="connected" />
              </div>
              
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Size:</span>
                  <span className="text-white">2.4 GB</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Tables:</span>
                  <span className="text-white">12</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Records:</span>
                  <span className="text-white">45,234</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleBackupPostgreSQL}
                  disabled={loading === 'backup-pg'}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'backup-pg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Backup
                </button>
                <button
                  onClick={handleOptimizePostgreSQL}
                  disabled={loading === 'optimize-pg'}
                  className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'optimize-pg' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                  Optimize
                </button>
              </div>
            </div>

            {/* Parquet */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <HardDrive className="h-6 w-6 text-purple-400" />
                  <h3 className="text-lg font-semibold text-white">Parquet Catalog</h3>
                </div>
                <StatusBadge status="connected" />
              </div>
              
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Size:</span>
                  <span className="text-white">15.8 GB</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Files:</span>
                  <span className="text-white">1,234</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Instruments:</span>
                  <span className="text-white">45</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleExportParquet}
                  disabled={loading === 'export-parquet'}
                  className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'export-parquet' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Export
                </button>
                <button
                  onClick={handleCleanParquet}
                  disabled={loading === 'clean-parquet'}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'clean-parquet' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Clean
                </button>
              </div>
            </div>

            {/* Redis */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Zap className="h-6 w-6 text-orange-400" />
                  <h3 className="text-lg font-semibold text-white">Redis Cache</h3>
                </div>
                <StatusBadge status="warning" />
              </div>
              
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between text-gray-400">
                  <span>Memory:</span>
                  <span className="text-white">512 MB</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Keys:</span>
                  <span className="text-white">8,456</span>
                </div>
                <div className="flex justify-between text-gray-400">
                  <span>Hit Rate:</span>
                  <span className="text-white">96.5%</span>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleFlushRedis}
                  disabled={loading === 'flush-redis'}
                  className="flex-1 px-3 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'flush-redis' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Flush
                </button>
                <button
                  onClick={handleRedisStats}
                  disabled={loading === 'stats-redis'}
                  className="flex-1 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 text-white rounded text-sm font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {loading === 'stats-redis' ? <Loader2 className="h-4 w-4 animate-spin" /> : <BarChart3 className="h-4 w-4" />}
                  Stats
                </button>
              </div>
            </div>
          </div>

          {/* PostgreSQL Tables */}
          <div className="bg-gray-800 rounded-lg border border-gray-700 mb-8">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">PostgreSQL Tables</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Records</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Last Updated</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {[
                    { name: 'orders', type: 'Trading', records: '12,456', size: '245 MB', updated: '2 min ago' },
                    { name: 'positions', type: 'Trading', records: '3,421', size: '89 MB', updated: '5 min ago' },
                    { name: 'executions', type: 'Trading', records: '45,234', size: '1.2 GB', updated: '1 min ago' },
                    { name: 'accounts', type: 'System', records: '12', size: '4 KB', updated: '1 hour ago' },
                    { name: 'instruments', type: 'Market Data', records: '456', size: '12 MB', updated: '30 min ago' },
                    { name: 'strategies', type: 'System', records: '8', size: '2 KB', updated: '2 hours ago' },
                  ].map((table) => (
                    <tr key={table.name} className="hover:bg-gray-700/50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">{table.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{table.type}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{table.records}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{table.size}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">{table.updated}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={() => handleViewTable(table.name)}
                          className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1"
                        >
                          <FileText className="h-4 w-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Maintenance Actions */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Maintenance Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={handleFullBackup}
                disabled={loading === 'full-backup'}
                className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
              >
                {loading === 'full-backup' ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
                Full Backup
              </button>
              <button
                className="px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
                onClick={() => info('Optimize All feature coming soon!')}
              >
                <Zap className="h-5 w-5" />
                Optimize All
              </button>
              <button
                className="px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
                onClick={() => info('Export Data feature coming soon!')}
              >
                <Upload className="h-5 w-5" />
                Export Data
              </button>
              <button
                className="px-4 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded font-medium transition-colors flex items-center justify-center gap-2"
                onClick={() => info('View Logs feature coming soon!')}
              >
                <FileText className="h-5 w-5" />
                View Logs
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabasePage;

