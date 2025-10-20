import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useNotification } from "@/contexts/NotificationContext";
import { API_CONFIG } from '@/config';

interface DatabaseConnection {
  id: number;
  name: string;
  type: string;
  host?: string;
  port?: number;
  database_name: string;
  connection_string: string;
  is_active: number;
  created_at: string;
  last_connected?: string;
}

interface Table {
  name: string;
}

interface Column {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  default_value: any;
  pk: number;
}

interface QueryHistory {
  id: number;
  query: string;
  execution_time: number;
  rows_affected: number;
  status: string;
  error_message?: string;
  executed_at: string;
}

interface Backup {
  id: number;
  backup_path: string;
  backup_size: number;
  backup_type: string;
  status: string;
  created_at: string;
}

const DB_MANAGER_API = 'https://8002-izgd9v56smwjcue9xjn05-99f39a2a.manusvm.computer';

export default function DatabaseManagementPage() {
  const { success, error: showError, info } = useNotification();
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [selectedConnection, setSelectedConnection] = useState<number | null>(null);
  const [tables, setTables] = useState<Table[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableSchema, setTableSchema] = useState<Column[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [pageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'connections' | 'tables' | 'query' | 'backups'>('connections');
  const [queryText, setQueryText] = useState('');
  const [queryResult, setQueryResult] = useState<any>(null);
  const [queryHistory, setQueryHistory] = useState<QueryHistory[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [showAddConnection, setShowAddConnection] = useState(false);
  const [connectionForm, setConnectionForm] = useState({
    name: '',
    type: 'sqlite',
    database_name: '',
    connection_string: ''
  });

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    if (selectedConnection) {
      loadTables();
      if (view === 'query') {
        loadQueryHistory();
      }
      if (view === 'backups') {
        loadBackups();
      }
    }
  }, [selectedConnection, view]);

  useEffect(() => {
    if (selectedTable && selectedConnection) {
      loadTableSchema();
      loadTableData();
    }
  }, [selectedTable, currentPage]);

  const loadConnections = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${DB_MANAGER_API}/api/db/connections`);
      const data = await response.json();
      setConnections(data.connections || []);
    } catch (err) {
      showError('Failed to load connections');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadTables = async () => {
    if (!selectedConnection) return;
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/tables`);
      const data = await response.json();
      setTables(data.tables || []);
    } catch (err) {
      showError('Failed to load tables');
    }
  };

  const loadTableSchema = async () => {
    if (!selectedConnection || !selectedTable) return;
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/tables/${selectedTable}/schema`);
      const data = await response.json();
      setTableSchema(data.columns || []);
    } catch (err) {
      showError('Failed to load table schema');
    }
  };

  const loadTableData = async () => {
    if (!selectedConnection || !selectedTable) return;
    try {
      const offset = currentPage * pageSize;
      const response = await fetch(
        `${DB_MANAGER_API}/api/db/${selectedConnection}/tables/${selectedTable}/data?limit=${pageSize}&offset=${offset}`
      );
      const data = await response.json();
      setTableData(data.rows || []);
      setTotalRows(data.total || 0);
    } catch (err) {
      showError('Failed to load table data');
    }
  };

  const loadQueryHistory = async () => {
    if (!selectedConnection) return;
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/query-history`);
      const data = await response.json();
      setQueryHistory(data.history || []);
    } catch (err) {
      showError('Failed to load query history');
    }
  };

  const loadBackups = async () => {
    if (!selectedConnection) return;
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/backups`);
      const data = await response.json();
      setBackups(data.backups || []);
    } catch (err) {
      showError('Failed to load backups');
    }
  };

  const handleTestConnection = async (connectionId: number) => {
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/connections/${connectionId}/test`, {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        success('Connection test successful');
      } else {
        showError(`Connection test failed: ${data.message}`);
      }
    } catch (err) {
      showError('Failed to test connection');
    }
  };

  const handleExecuteQuery = async () => {
    if (!selectedConnection || !queryText.trim()) return;
    
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText })
      });
      const data = await response.json();
      setQueryResult(data);
      
      if (data.success) {
        success(`Query executed in ${data.execution_time.toFixed(3)}s`);
        loadQueryHistory();
      } else {
        showError(`Query failed: ${data.error}`);
      }
    } catch (err) {
      showError('Failed to execute query');
    }
  };

  const handleCreateBackup = async () => {
    if (!selectedConnection) return;
    
    try {
      info('Creating backup...');
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/backup`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        success(`Backup created: ${(data.backup_size / 1024).toFixed(2)} KB`);
        loadBackups();
      }
    } catch (err) {
      showError('Failed to create backup');
    }
  };

  const handleRestoreBackup = async (backupId: number) => {
    if (!selectedConnection) return;
    if (!confirm('Are you sure you want to restore this backup? Current data will be overwritten.')) return;
    
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/${selectedConnection}/restore/${backupId}`, {
        method: 'POST'
      });
      const data = await response.json();
      
      if (data.success) {
        success('Database restored successfully');
        loadTables();
      }
    } catch (err) {
      showError('Failed to restore backup');
    }
  };

  const handleAddConnection = async () => {
    try {
      const response = await fetch(`${DB_MANAGER_API}/api/db/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(connectionForm)
      });
      const data = await response.json();
      
      if (data.success) {
        success('Connection added successfully');
        setShowAddConnection(false);
        setConnectionForm({ name: '', type: 'sqlite', database_name: '', connection_string: '' });
        loadConnections();
      }
    } catch (err) {
      showError('Failed to add connection');
    }
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      'sqlite': '📁',
      'postgresql': '🐘',
      'redis': '🔴',
      'parquet': '📊'
    };
    return icons[type] || '💾';
  };

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">💾 Database Management</h1>
              <p className="text-sm text-gray-600 mt-1">
                Comprehensive database administration system
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadConnections} variant="outline">
                ↻ Refresh
              </Button>
              <Button onClick={() => window.history.back()} variant="outline">
                ← Back
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left Sidebar - Connections */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Connections</CardTitle>
                  <Button onClick={() => setShowAddConnection(true)} size="sm">+</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {connections.map(conn => (
                    <div
                      key={conn.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedConnection === conn.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                      onClick={() => {
                        setSelectedConnection(conn.id);
                        setView('tables');
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-lg">{getTypeIcon(conn.type)}</span>
                        <span className="font-semibold text-sm">{conn.name}</span>
                      </div>
                      <div className="text-xs text-gray-600">{conn.type}</div>
                      {conn.is_active === 0 && (
                        <span className="text-xs px-2 py-1 bg-gray-200 text-gray-600 rounded mt-1 inline-block">
                          Inactive
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Connection Form */}
                {showAddConnection && (
                  <div className="mt-4 p-3 border border-green-200 rounded-lg bg-green-50">
                    <h4 className="font-semibold mb-2 text-sm">Add Connection</h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        placeholder="Name"
                        value={connectionForm.name}
                        onChange={(e) => setConnectionForm({ ...connectionForm, name: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                      <select
                        value={connectionForm.type}
                        onChange={(e) => setConnectionForm({ ...connectionForm, type: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      >
                        <option value="sqlite">SQLite</option>
                        <option value="postgresql">PostgreSQL</option>
                        <option value="redis">Redis</option>
                        <option value="parquet">Parquet</option>
                      </select>
                      <input
                        type="text"
                        placeholder="Database Name"
                        value={connectionForm.database_name}
                        onChange={(e) => setConnectionForm({ ...connectionForm, database_name: e.target.value })}
                        className="w-full px-2 py-1 border rounded text-sm"
                      />
                      <input
                        type="text"
                        placeholder="Connection String"
                        value={connectionForm.connection_string}
                        onChange={(e) => setConnectionForm({ ...connectionForm, connection_string: e.target.value })}
                        className="w-full px-2 py-1 border rounded font-mono text-xs"
                      />
                      <div className="flex gap-2">
                        <Button onClick={handleAddConnection} size="sm" className="bg-green-600">Save</Button>
                        <Button onClick={() => setShowAddConnection(false)} size="sm" variant="outline">Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Content Area */}
          <div className="lg:col-span-3">
            {selectedConnection ? (
              <>
                {/* View Tabs */}
                <div className="flex gap-2 mb-4">
                  <Button
                    onClick={() => setView('tables')}
                    variant={view === 'tables' ? 'default' : 'outline'}
                    size="sm"
                  >
                    📋 Tables
                  </Button>
                  <Button
                    onClick={() => setView('query')}
                    variant={view === 'query' ? 'default' : 'outline'}
                    size="sm"
                  >
                    ⚡ Query
                  </Button>
                  <Button
                    onClick={() => setView('backups')}
                    variant={view === 'backups' ? 'default' : 'outline'}
                    size="sm"
                  >
                    💾 Backups
                  </Button>
                </div>

                {/* Tables View */}
                {view === 'tables' && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Tables List */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Tables</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1">
                          {tables.map(table => (
                            <div
                              key={table.name}
                              className={`p-2 rounded cursor-pointer text-sm ${
                                selectedTable === table.name
                                  ? 'bg-blue-100 text-blue-700 font-semibold'
                                  : 'hover:bg-gray-100'
                              }`}
                              onClick={() => {
                                setSelectedTable(table.name);
                                setCurrentPage(0);
                              }}
                            >
                              📄 {table.name}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Table Details */}
                    <div className="lg:col-span-2">
                      {selectedTable ? (
                        <>
                          {/* Schema */}
                          <Card className="mb-4">
                            <CardHeader>
                              <CardTitle className="text-lg">Schema: {selectedTable}</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      <th className="px-3 py-2 text-left">Column</th>
                                      <th className="px-3 py-2 text-left">Type</th>
                                      <th className="px-3 py-2 text-left">Null</th>
                                      <th className="px-3 py-2 text-left">Key</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tableSchema.map(col => (
                                      <tr key={col.cid} className="border-t">
                                        <td className="px-3 py-2 font-mono">{col.name}</td>
                                        <td className="px-3 py-2 text-gray-600">{col.type}</td>
                                        <td className="px-3 py-2">{col.notnull ? '❌' : '✅'}</td>
                                        <td className="px-3 py-2">{col.pk ? '🔑 PK' : ''}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>

                          {/* Data */}
                          <Card>
                            <CardHeader>
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-lg">Data ({totalRows} rows)</CardTitle>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                                    disabled={currentPage === 0}
                                    size="sm"
                                    variant="outline"
                                  >
                                    ← Prev
                                  </Button>
                                  <span className="px-3 py-1 text-sm">
                                    Page {currentPage + 1} / {Math.ceil(totalRows / pageSize)}
                                  </span>
                                  <Button
                                    onClick={() => setCurrentPage(currentPage + 1)}
                                    disabled={(currentPage + 1) * pageSize >= totalRows}
                                    size="sm"
                                    variant="outline"
                                  >
                                    Next →
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead className="bg-gray-100">
                                    <tr>
                                      {tableSchema.map(col => (
                                        <th key={col.name} className="px-3 py-2 text-left font-mono text-xs">
                                          {col.name}
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {tableData.map((row, idx) => (
                                      <tr key={idx} className="border-t hover:bg-gray-50">
                                        {tableSchema.map(col => (
                                          <td key={col.name} className="px-3 py-2 text-xs">
                                            {row[col.name] !== null ? String(row[col.name]) : <span className="text-gray-400">NULL</span>}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </CardContent>
                          </Card>
                        </>
                      ) : (
                        <Card>
                          <CardContent className="py-12 text-center text-gray-500">
                            Select a table to view its schema and data
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {/* Query View */}
                {view === 'query' && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>SQL Query Editor</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <textarea
                          value={queryText}
                          onChange={(e) => setQueryText(e.target.value)}
                          className="w-full h-32 p-3 border rounded font-mono text-sm"
                          placeholder="Enter SQL query..."
                        />
                        <div className="flex gap-2 mt-3">
                          <Button onClick={handleExecuteQuery} className="bg-green-600">
                            ▶️ Execute
                          </Button>
                          <Button onClick={() => setQueryText('')} variant="outline">
                            Clear
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Query Result */}
                    {queryResult && (
                      <Card>
                        <CardHeader>
                          <CardTitle>
                            {queryResult.success ? '✅ Query Result' : '❌ Query Error'}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          {queryResult.success ? (
                            <>
                              <div className="text-sm text-gray-600 mb-3">
                                Execution time: {queryResult.execution_time.toFixed(3)}s | 
                                Rows affected: {queryResult.rows_affected}
                              </div>
                              {queryResult.rows && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-sm border">
                                    <thead className="bg-gray-100">
                                      <tr>
                                        {Object.keys(queryResult.rows[0] || {}).map(key => (
                                          <th key={key} className="px-3 py-2 text-left border">{key}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {queryResult.rows.map((row: any, idx: number) => (
                                        <tr key={idx} className="border-t">
                                          {Object.values(row).map((val: any, i: number) => (
                                            <td key={i} className="px-3 py-2 border text-xs">
                                              {val !== null ? String(val) : <span className="text-gray-400">NULL</span>}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                              {queryResult.message && (
                                <div className="text-sm text-green-700">{queryResult.message}</div>
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-red-700 bg-red-50 p-3 rounded">
                              {queryResult.error}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    )}

                    {/* Query History */}
                    <Card>
                      <CardHeader>
                        <CardTitle>Query History</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {queryHistory.slice(0, 10).map(item => (
                            <div key={item.id} className="p-3 border rounded">
                              <div className="flex items-center justify-between mb-2">
                                <span className={`text-xs px-2 py-1 rounded ${
                                  item.status === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                  {item.status}
                                </span>
                                <span className="text-xs text-gray-500">
                                  {new Date(item.executed_at).toLocaleString()} | {item.execution_time.toFixed(3)}s
                                </span>
                              </div>
                              <pre className="text-xs bg-gray-100 p-2 rounded font-mono overflow-x-auto">
                                {item.query}
                              </pre>
                              {item.error_message && (
                                <div className="text-xs text-red-600 mt-2">{item.error_message}</div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Backups View */}
                {view === 'backups' && (
                  <div className="space-y-4">
                    <Card>
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle>Database Backups</CardTitle>
                          <Button onClick={handleCreateBackup} className="bg-green-600">
                            💾 Create Backup
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {backups.map(backup => (
                            <div key={backup.id} className="p-4 border rounded-lg">
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <div className="font-semibold text-sm">{backup.backup_type} backup</div>
                                  <div className="text-xs text-gray-600">{formatBytes(backup.backup_size)}</div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs px-2 py-1 rounded ${
                                    backup.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {backup.status}
                                  </span>
                                  {backup.status === 'completed' && (
                                    <Button onClick={() => handleRestoreBackup(backup.id)} size="sm" variant="outline">
                                      ↻ Restore
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="text-xs font-mono text-gray-500 mb-2">{backup.backup_path}</div>
                              <div className="text-xs text-gray-500">
                                {new Date(backup.created_at).toLocaleString()}
                              </div>
                            </div>
                          ))}
                          {backups.length === 0 && (
                            <div className="text-center py-8 text-gray-500">
                              No backups yet. Create your first backup!
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center text-gray-500">
                  <div className="text-4xl mb-4">👈</div>
                  <div>Select a database connection to start</div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

