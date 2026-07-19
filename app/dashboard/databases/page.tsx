'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Database, Table, Play, Server, HardDrive, Activity, RefreshCw, 
  ChevronRight, ChevronDown, Eye, Key, Code, Layers, Grid, List, 
  Search, FileText, Workflow, Hash, Puzzle, Copy, Download, 
  FileSpreadsheet, FileJson, CheckCircle, XCircle, Clock, 
  AlertCircle, MoreVertical, Trash2, Edit, FilePlus, 
  FileOutput, TableProperties, Terminal, DatabaseBackup,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

// ============================================================
// Types
// ============================================================

type Client = {
  id: string;
  name: string;
  email: string;
  status: string;
  schema_name: string;
  storage_limit_mb: number;
  db_limit_mb: number;
  created_at: string;
};

type DbTable = {
  name: string;
  columns: number;
  rows: number;
  size: string;
};

type SqlResult = {
  success: boolean;
  data?: any[];
  rowCount?: number;
  executionTime?: string;
  columns?: string[];
  error?: string;
  code?: string;
  detail?: string;
  hint?: string;
};

type QueryHistoryItem = {
  id: string;
  query: string;
  timestamp: string;
  duration: string;
  rowCount: number;
  success: boolean;
  user: string;
  database: string;
};

type DatabaseObject = {
  name: string;
  type: 'schema' | 'table' | 'view' | 'function' | 'trigger' | 'index' | 'sequence' | 'extension';
  children?: DatabaseObject[];
};

// ============================================================
// Main Component
// ============================================================

export default function DatabasesPage() {
  return (
    <RouteGuard>
      <DatabasesContent />
    </RouteGuard>
  );
}

function DatabasesContent() {
  // ============================================================
  // State
  // ============================================================
  
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [sql, setSql] = useState('');
  const [sqlResult, setSqlResult] = useState<SqlResult | null>(null);
  const [sqlRunning, setSqlRunning] = useState(false);
  const [tables, setTables] = useState<DbTable[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [tableColumns, setTableColumns] = useState<any[]>([]);
  const [tableData, setTableData] = useState<any[]>([]);
  const [dbExplorer, setDbExplorer] = useState<DatabaseObject[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [queryHistory, setQueryHistory] = useState<QueryHistoryItem[]>([]);
  const [pageSize, setPageSize] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [isLoadingTable, setIsLoadingTable] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ============================================================
  // Effects
  // ============================================================
  
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Client[]>('/api/admin/tenants');
        setClients((data ?? []).filter((c) => c.status === 'active'));
      } catch {
        // fall through
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Load query history from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('queryHistory');
      if (saved) {
        setQueryHistory(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
  }, []);

  // Save query history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('queryHistory', JSON.stringify(queryHistory));
    } catch {
      // ignore
    }
  }, [queryHistory]);

  // Keyboard shortcut: Ctrl+Enter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runSql();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sql, selectedClient]);

  // ============================================================
  // Core Functions
  // ============================================================

  const validateTableName = async (schema: string, tableName: string): Promise<boolean> => {
    const query = `
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = $2
      )
    `;
    const result = await executeQuery(query, [schema, tableName]);
    return result.data?.[0]?.exists || false;
  };

  const loadClientData = useCallback(async (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    setSelectedClient(client);
    setTables([]);
    setSelectedTable(null);
    setTableColumns([]);
    setTableData([]);
    setSqlResult(null);
    setDbExplorer([]);
    
    const schema = client.schema_name;
    
    try {
      // Tables
      const tablesQuery = `
        SELECT 
          table_name,
          (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = t.table_schema) as columns
        FROM information_schema.tables t 
        WHERE table_schema = $1
        ORDER BY table_name
      `;
      
      const tablesResult = await executeQuery(tablesQuery, [schema]);
      let tableData: DbTable[] = [];
      if (tablesResult.success && tablesResult.data) {
        tableData = tablesResult.data.map((row: any) => ({
          name: row.table_name,
          columns: parseInt(row.columns),
          rows: 0,
          size: '-'
        }));
        setTables(tableData);
      }

      // Views
      const viewsQuery = `
        SELECT table_name 
        FROM information_schema.views 
        WHERE table_schema = $1
        ORDER BY table_name
      `;
      const viewsResult = await executeQuery(viewsQuery, [schema]);
      const views = viewsResult.success ? (viewsResult.data?.map((row: any) => row.table_name) || []) : [];

      // Functions
      const functionsQuery = `
        SELECT proname as name
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = $1
        ORDER BY proname
      `;
      const functionsResult = await executeQuery(functionsQuery, [schema]);
      const functions = functionsResult.success ? (functionsResult.data?.map((row: any) => row.name) || []) : [];

      // Triggers
      const triggersQuery = `
        SELECT trigger_name
        FROM information_schema.triggers
        WHERE trigger_schema = $1
        ORDER BY trigger_name
      `;
      const triggersResult = await executeQuery(triggersQuery, [schema]);
      const triggers = triggersResult.success ? (triggersResult.data?.map((row: any) => row.trigger_name) || []) : [];

      // Indexes
      const indexesQuery = `
        SELECT indexname as name
        FROM pg_indexes
        WHERE schemaname = $1
        ORDER BY indexname
      `;
      const indexesResult = await executeQuery(indexesQuery, [schema]);
      const indexes = indexesResult.success ? (indexesResult.data?.map((row: any) => row.name) || []) : [];

      // Sequences
      const sequencesQuery = `
        SELECT sequence_name
        FROM information_schema.sequences
        WHERE sequence_schema = $1
        ORDER BY sequence_name
      `;
      const sequencesResult = await executeQuery(sequencesQuery, [schema]);
      const sequences = sequencesResult.success ? (sequencesResult.data?.map((row: any) => row.sequence_name) || []) : [];

      // Extensions
      const extensionsQuery = `
        SELECT extname as name
        FROM pg_extension e
        JOIN pg_namespace n ON e.extnamespace = n.oid
        WHERE n.nspname = $1
        ORDER BY extname
      `;
      const extensionsResult = await executeQuery(extensionsQuery, [schema]);
      const extensions = extensionsResult.success ? (extensionsResult.data?.map((row: any) => row.name) || []) : [];

      // Build Database Explorer
      const explorer: DatabaseObject[] = [
        { name: 'Schemas', type: 'schema', children: [{ name: schema, type: 'schema' }] }
      ];

      if (tableData.length > 0) {
        explorer.push({
          name: 'Tables',
          type: 'table',
          children: tableData.map((row: any) => ({
            name: row.name,
            type: 'table' as const
          }))
        });
      }

      if (views.length > 0) {
        explorer.push({
          name: 'Views',
          type: 'view',
          children: views.map((v: string) => ({ name: v, type: 'view' as const }))
        });
      }

      if (functions.length > 0) {
        explorer.push({
          name: 'Functions',
          type: 'function',
          children: functions.map((f: string) => ({ name: f, type: 'function' as const }))
        });
      }

      if (triggers.length > 0) {
        explorer.push({
          name: 'Triggers',
          type: 'trigger',
          children: triggers.map((t: string) => ({ name: t, type: 'trigger' as const }))
        });
      }

      if (indexes.length > 0) {
        explorer.push({
          name: 'Indexes',
          type: 'index',
          children: indexes.map((i: string) => ({ name: i, type: 'index' as const }))
        });
      }

      if (sequences.length > 0) {
        explorer.push({
          name: 'Sequences',
          type: 'sequence',
          children: sequences.map((s: string) => ({ name: s, type: 'sequence' as const }))
        });
      }

      if (extensions.length > 0) {
        explorer.push({
          name: 'Extensions',
          type: 'extension',
          children: extensions.map((e: string) => ({ name: e, type: 'extension' as const }))
        });
      }

      setDbExplorer(explorer);
      
    } catch (error) {
      console.error('Error loading client data:', error);
      toast.error('فشل تحميل بيانات العميل');
    }
  }, [clients]);

  const executeQuery = async (query: string, params?: any[]): Promise<SqlResult> => {
    try {
      const startTime = performance.now();
      const response = await fetch('/api/v1/sql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: query, params })
      });
      
      const endTime = performance.now();
      const result = await response.json();
      
      return {
        ...result,
        executionTime: `${(endTime - startTime).toFixed(0)}ms`
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  };

  const loadTableData = async (tableName: string) => {
    if (!selectedClient) return;
    
    setIsLoadingTable(true);
    
    const isValid = await validateTableName(selectedClient.schema_name, tableName);
    if (!isValid) {
      toast.error('الجدول غير موجود');
      setIsLoadingTable(false);
      return;
    }
    
    setSelectedTable(tableName);
    setTableColumns([]);
    setTableData([]);
    setCurrentPage(1);
    
    const schema = selectedClient.schema_name;
    
    try {
      const columnsQuery = `
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `;
      
      const columnsResult = await executeQuery(columnsQuery, [schema, tableName]);
      if (columnsResult.success && columnsResult.data) {
        setTableColumns(columnsResult.data);
      }
      
      const offset = (currentPage - 1) * pageSize;
      const dataQuery = `SELECT * FROM ${schema}.${tableName} LIMIT ${pageSize} OFFSET ${offset}`;
      const dataResult = await executeQuery(dataQuery);
      if (dataResult.success && dataResult.data) {
        setTableData(dataResult.data);
      }
      
    } catch (error) {
      console.error('Error loading table data:', error);
      toast.error('فشل تحميل بيانات الجدول');
    } finally {
      setIsLoadingTable(false);
    }
  };

  const runSql = async () => {
    if (!selectedClient) {
      toast.error('اختر عميلاً أولاً');
      return;
    }
    
    if (!sql.trim()) {
      toast.error('أدخل استعلام SQL');
      return;
    }
    
    setSqlRunning(true);
    setSqlResult(null);

    try {
      const startTime = performance.now();
      const result = await executeQuery(sql);
      const endTime = performance.now();
      
      setSqlResult({
        ...result,
        executionTime: `${(endTime - startTime).toFixed(0)}ms`
      });
      
      // Add to history
      const historyItem: QueryHistoryItem = {
        id: Date.now().toString(),
        query: sql,
        timestamp: new Date().toISOString(),
        duration: `${(endTime - startTime).toFixed(0)}ms`,
        rowCount: result.rowCount || 0,
        success: result.success,
        user: selectedClient?.name || 'Unknown',
        database: selectedClient?.schema_name || 'Unknown'
      };
      setQueryHistory(prev => [historyItem, ...prev.slice(0, 49)]);
      
      if (result.success) {
        toast.success(`تم التنفيذ بنجاح - ${result.rowCount || 0} صف`);
      } else {
        toast.error(result.error || 'خطأ في تنفيذ الاستعلام');
      }
    } catch (error: any) {
      setSqlResult({
        success: false,
        error: error.message
      });
      toast.error('خطأ في تنفيذ الاستعلام');
    } finally {
      setSqlRunning(false);
    }
  };

  // ============================================================
  // Utility Functions
  // ============================================================

  const formatSql = () => {
    try {
      const formatted = sql
        .replace(/SELECT /gi, 'SELECT\n  ')
        .replace(/FROM /gi, '\nFROM ')
        .replace(/WHERE /gi, '\nWHERE ')
        .replace(/ORDER BY /gi, '\nORDER BY ')
        .replace(/GROUP BY /gi, '\nGROUP BY ')
        .replace(/JOIN /gi, '\nJOIN ')
        .replace(/LEFT JOIN /gi, '\nLEFT JOIN ')
        .replace(/INNER JOIN /gi, '\nINNER JOIN ')
        .replace(/AND /gi, '\n  AND ')
        .replace(/OR /gi, '\n  OR ');
      setSql(formatted);
      toast.success('تم تنسيق الاستعلام');
    } catch {
      toast.error('فشل تنسيق الاستعلام');
    }
  };

  const copyResult = () => {
    if (!sqlResult?.data) {
      toast.error('لا توجد نتيجة للنسخ');
      return;
    }
    const text = JSON.stringify(sqlResult.data, null, 2);
    navigator.clipboard.writeText(text);
    toast.success('تم نسخ النتيجة');
  };

  const exportCsv = () => {
    if (!sqlResult?.data || sqlResult.data.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    
    const headers = sqlResult.columns?.join(',') || '';
    const rows = sqlResult.data.map(row => 
      sqlResult.columns?.map(col => `"${String(row[col] || '')}"`).join(',')
    ).join('\n');
    
    const csv = `${headers}\n${rows}`;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير CSV');
  };

  const exportJson = () => {
    if (!sqlResult?.data || sqlResult.data.length === 0) {
      toast.error('لا توجد بيانات للتصدير');
      return;
    }
    
    const json = JSON.stringify(sqlResult.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('تم تصدير JSON');
  };

  const toggleExpand = (name: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(name)) {
      newExpanded.delete(name);
    } else {
      newExpanded.add(name);
    }
    setExpandedItems(newExpanded);
  };

  const filterExplorer = (items: DatabaseObject[]): DatabaseObject[] => {
    if (!searchTerm) return items;
    return items
      .map(item => ({
        ...item,
        children: item.children?.filter(child => 
          child.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      }))
      .filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.children && item.children.length > 0)
      );
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'schema': return <Layers className="w-4 h-4" />;
      case 'table': return <Table className="w-4 h-4 text-blue-500" />;
      case 'view': return <Eye className="w-4 h-4 text-green-500" />;
      case 'function': return <Code className="w-4 h-4 text-purple-500" />;
      case 'trigger': return <Workflow className="w-4 h-4 text-orange-500" />;
      case 'index': return <Hash className="w-4 h-4 text-yellow-500" />;
      case 'sequence': return <List className="w-4 h-4 text-pink-500" />;
      case 'extension': return <Puzzle className="w-4 h-4 text-indigo-500" />;
      default: return <Database className="w-4 h-4" />;
    }
  };

  const getStatusIcon = (success: boolean) => {
    return success ? 
      <CheckCircle className="w-4 h-4 text-green-500" /> : 
      <XCircle className="w-4 h-4 text-red-500" />;
  };

  const renderExplorerItem = (item: DatabaseObject, level: number = 0) => {
    const isExpanded = expandedItems.has(item.name);
    const hasChildren = item.children && item.children.length > 0;
    
    return (
      <div key={item.name}>
        <div
          className={`flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer transition-colors ${
            level > 0 ? 'mr-4' : ''
          } ${selectedTable === item.name ? 'bg-muted' : ''}`}
          onClick={() => {
            if (hasChildren) {
              toggleExpand(item.name);
            } else if (item.type === 'table') {
              loadTableData(item.name);
            }
          }}
        >
          {hasChildren && (
            <span className="w-4 h-4 flex items-center justify-center">
              {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </span>
          )}
          {!hasChildren && <span className="w-4" />}
          {getIcon(item.type)}
          <span className="text-sm font-mono">{item.name}</span>
          {item.type === 'table' && (
            <span className="text-xs text-muted-foreground mr-auto">
              {tables.find(t => t.name === item.name)?.columns || 0} أعمدة
            </span>
          )}
        </div>
        {isExpanded && hasChildren && (
          <div className="mr-4">
            {item.children?.map(child => renderExplorerItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // Render
  // ============================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">قواعد البيانات</h1>
          <p className="text-muted-foreground mt-1">إدارة قواعد بيانات PostgreSQL للعملاء</p>
        </div>
        {selectedClient && (
          <Badge variant="outline" className="text-sm">
            <Server className="w-4 h-4 ml-2" />
            PostgreSQL 16 | {selectedClient.schema_name}
          </Badge>
        )}
      </div>

      {/* Client selector */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Select value={selectedClient?.id || ''} onValueChange={loadClientData}>
          <SelectTrigger className="w-full sm:w-72"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
          <SelectContent>
            {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {selectedClient && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{(selectedClient.db_limit_mb / 1024).toFixed(1)} GB حد أقصى</Badge>
            <Badge variant="outline">{selectedClient.schema_name}</Badge>
          </div>
        )}
      </div>

      {loading ? (
        <Skeleton className="h-64" />
      ) : !selectedClient ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>اختر عميلاً لعرض قاعدة بياناته</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Database Explorer */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">مستكشف قاعدة البيانات</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setExpandedItems(new Set())}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
              <div className="relative mt-2">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 h-9 text-sm"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[600px] overflow-y-auto scrollbar-thin">
                {filterExplorer(dbExplorer).map(item => renderExplorerItem(item))}
              </div>
            </CardContent>
          </Card>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Tabs defaultValue="tables" className="space-y-4">
              <TabsList>
                <TabsTrigger value="tables">الجداول</TabsTrigger>
                <TabsTrigger value="sql">SQL Editor</TabsTrigger>
                <TabsTrigger value="history">السجل</TabsTrigger>
                <TabsTrigger value="info">معلومات</TabsTrigger>
              </TabsList>

              {/* Tables tab */}
              <TabsContent value="tables">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">
                          {selectedTable ? `جدول: ${selectedTable}` : 'اختر جدولاً لعرض البيانات'}
                        </CardTitle>
                        {selectedTable && (
                          <CardDescription>
                            {isLoadingTable ? 'جاري التحميل...' : `${tableData.length} صف | عرض ${pageSize} صف`}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {selectedTable && (
                          <>
                            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                              <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="25">25</SelectItem>
                                <SelectItem value="50">50</SelectItem>
                                <SelectItem value="100">100</SelectItem>
                                <SelectItem value="500">500</SelectItem>
                                <SelectItem value="1000">1000</SelectItem>
                              </SelectContent>
                            </Select>
                            <Button size="sm" variant="outline" onClick={() => loadTableData(selectedTable)} disabled={isLoadingTable}>
                              {isLoadingTable ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <RefreshCw className="w-4 h-4 ml-2" />}
                              تحديث
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {selectedTable ? (
                      <div className="overflow-x-auto scrollbar-thin">
                        {isLoadingTable ? (
                          <div className="p-8 text-center">
                            <Loader2 className="w-8 h-8 mx-auto animate-spin text-muted-foreground" />
                            <p className="text-muted-foreground mt-2">جاري تحميل البيانات...</p>
                          </div>
                        ) : tableData.length > 0 ? (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/30">
                                <th className="text-right py-2 px-3 w-8 text-muted-foreground text-xs">#</th>
                                {tableColumns.map((col) => (
                                  <th key={col.column_name} className="text-right py-2 px-3 font-medium text-muted-foreground">
                                    <div className="flex flex-col">
                                      <span className="font-mono">{col.column_name}</span>
                                      <span className="text-xs text-muted-foreground">{col.data_type}</span>
                                    </div>
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tableData.map((row, idx) => (
                                <tr 
                                  key={idx} 
                                  className={`border-b hover:bg-muted/30 transition-colors cursor-pointer ${
                                    selectedRow === idx ? 'bg-muted/50' : ''
                                  }`}
                                  onClick={() => setSelectedRow(selectedRow === idx ? null : idx)}
                                >
                                  <td className="py-2 px-3 text-muted-foreground text-xs text-center">
                                    {(currentPage - 1) * pageSize + idx + 1}
                                  </td>
                                  {tableColumns.map((col) => (
                                    <td key={col.column_name} className="py-2 px-3 font-mono text-sm">
                                      {row[col.column_name] !== undefined && row[col.column_name] !== null ? (
                                        typeof row[col.column_name] === 'object' ? (
                                          <pre className="text-xs bg-muted/30 p-1 rounded">{JSON.stringify(row[col.column_name])}</pre>
                                        ) : (
                                          String(row[col.column_name])
                                        )
                                      ) : (
                                        <span className="text-muted-foreground italic">null</span>
                                      )}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="p-8 text-center text-muted-foreground">
                            <Table className="w-8 h-8 mx-auto mb-2 opacity-50" />
                            <p>لا توجد بيانات في هذا الجدول</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-8 text-center text-muted-foreground">
                        <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>اختر جدولاً من المستكشف</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* SQL Editor tab - مع الجدول المحسن */}
              <TabsContent value="sql">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">SQL Editor</CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                          {selectedClient.schema_name} | Ctrl+Enter للتنفيذ
                        </CardDescription>
                      </div>
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={formatSql}>
                          <Code className="w-4 h-4 ml-2" />
                          تنسيق
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setSql('SELECT * FROM products LIMIT 10;')}>
                          مثال
                        </Button>
                        <Button size="sm" onClick={runSql} disabled={sqlRunning}>
                          {sqlRunning ? <Loader2 className="w-4 h-4 ml-2 animate-spin" /> : <Play className="w-4 h-4 ml-2" />}
                          {sqlRunning ? 'جاري التنفيذ...' : 'تنفيذ'}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <textarea
                      ref={textareaRef}
                      value={sql}
                      onChange={(e) => setSql(e.target.value)}
                      placeholder="SELECT * FROM users LIMIT 10;"
                      className="w-full h-40 rounded-lg border border-input bg-background px-4 py-3 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 scrollbar-thin"
                      dir="ltr"
                      spellCheck={false}
                    />

                    {sqlResult && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Label>النتيجة</Label>
                            {sqlResult.success ? (
                              <Badge variant="success" className="text-xs">✓ نجاح</Badge>
                            ) : (
                              <Badge variant="destructive" className="text-xs">✗ فشل</Badge>
                            )}
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground items-center">
                            {sqlResult.success && (
                              <>
                                <span>الصفوف: {sqlResult.rowCount}</span>
                                <span>الزمن: {sqlResult.executionTime}</span>
                              </>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={copyResult}>
                              <Copy className="w-3 h-3 ml-1" />
                              نسخ
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={exportCsv}>
                              <FileSpreadsheet className="w-3 h-3 ml-1" />
                              CSV
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={exportJson}>
                              <FileJson className="w-3 h-3 ml-1" />
                              JSON
                            </Button>
                          </div>
                        </div>
                        
                        {sqlResult.success ? (
                          <div className="overflow-x-auto scrollbar-thin rounded-lg border">
                            {sqlResult.data && sqlResult.data.length > 0 ? (
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b bg-muted/30">
                                    <th className="text-right py-2 px-3 w-8 text-muted-foreground text-xs">#</th>
                                    {sqlResult.columns?.map((col) => (
                                      <th key={col} className="text-right py-2 px-3 font-medium text-muted-foreground">
                                        <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">{col}</span>
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {sqlResult.data.map((row, idx) => (
                                    <tr key={idx} className="border-b hover:bg-muted/30 transition-colors">
                                      <td className="py-2 px-3 text-muted-foreground text-xs text-center">{idx + 1}</td>
                                      {sqlResult.columns?.map((col) => (
                                        <td key={col} className="py-2 px-3 font-mono text-sm">
                                          {row[col] !== undefined && row[col] !== null ? (
                                            typeof row[col] === 'object' ? (
                                              <pre className="text-xs bg-muted/30 p-1 rounded">{JSON.stringify(row[col])}</pre>
                                            ) : (
                                              String(row[col])
                                            )
                                          ) : (
                                            <span className="text-muted-foreground italic">null</span>
                                          )}
                                        </td>
                                      ))}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            ) : (
                              <div className="p-8 text-center text-muted-foreground">
                                <Database className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p>الاستعلام تم بنجاح - 0 صف</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                              <div>
                                <p className="text-destructive font-semibold">ERROR: {sqlResult.error}</p>
                                {sqlResult.detail && (
                                  <p className="text-sm text-muted-foreground mt-1">{sqlResult.detail}</p>
                                )}
                                {sqlResult.hint && (
                                  <p className="text-sm text-muted-foreground mt-1">HINT: {sqlResult.hint}</p>
                                )}
                                {sqlResult.code && (
                                  <p className="text-xs text-muted-foreground mt-1">CODE: {sqlResult.code}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* History tab */}
              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-sm">سجل الاستعلامات</CardTitle>
                        <CardDescription>آخر 50 استعلام تم تنفيذها</CardDescription>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => {
                          setQueryHistory([]);
                          localStorage.removeItem('queryHistory');
                          toast.success('تم مسح السجل');
                        }}
                      >
                        <Trash2 className="w-4 h-4 ml-2" />
                        مسح الكل
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {queryHistory.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>لا توجد استعلامات في السجل</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {queryHistory.map((item) => (
                          <div
                            key={item.id}
                            className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors"
                            onClick={() => setSql(item.query)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                {getStatusIcon(item.success)}
                                <span className="font-mono text-sm truncate">{item.query}</span>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground flex-shrink-0">
                                <span>{item.duration}</span>
                                <span>{item.rowCount} صف</span>
                                <span>{new Date(item.timestamp).toLocaleString()}</span>
                                <span className="text-xs text-muted-foreground">{item.user}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Info tab */}
              <TabsContent value="info">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Server className="w-5.5 h-5.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">PostgreSQL 16.4</p>
                        <p className="text-sm text-muted-foreground">إصدار الخادم</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center">
                        <HardDrive className="w-5.5 h-5.5 text-success" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{tables.length} جداول</p>
                        <p className="text-sm text-muted-foreground">عدد الجداول</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-6 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-warning/10 flex items-center justify-center">
                        <Database className="w-5.5 h-5.5 text-warning" />
                      </div>
                      <div>
                        <p className="text-lg font-bold">{selectedClient.schema_name}</p>
                        <p className="text-sm text-muted-foreground">المخطط (Schema)</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      )}
    </div>
  );
}