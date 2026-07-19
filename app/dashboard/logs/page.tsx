'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollText, Search, Clock, Activity, Shield, Database, KeyRound, HardDrive, Archive, User, AppWindow } from 'lucide-react';

// Inline type — no longer imported from @/lib/supabase/client
type AuditLog = {
  id: string;
  action: string;
  entity_type?: string | null;
  created_at: string;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
};

const actionIcons: Record<string, typeof Activity> = {
  'client': User,
  'application': AppWindow,
  'license': KeyRound,
  'database': Database,
  'storage': HardDrive,
  'backup': Archive,
  'api_key': KeyRound,
};

function getIcon(action: string) {
  const prefix = action.split('.')[0];
  return actionIcons[prefix] ?? Activity;
}

function getActionColor(action: string): string {
  if (action.includes('created')) return 'success';
  if (action.includes('deleted')) return 'destructive';
  if (action.includes('suspended') || action.includes('revoked')) return 'warning';
  return 'default';
}

export default function LogsPage() {
  return (
    <RouteGuard>
      <LogsContent />
    </RouteGuard>
  );
}

function LogsContent() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('all');

  const fetchLogs = useCallback(async () => {
    try {
      const data = await apiGet<AuditLog[]>('/api/admin/audit-logs?limit=200');
      setLogs(data ?? []);
    } catch {
      // fall through to empty state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filtered = logs.filter((log) => {
    const matchesSearch = log.action.includes(search) || JSON.stringify(log.details ?? {}).includes(search);
    const matchesFilter = actionFilter === 'all' || log.action.startsWith(actionFilter);
    return matchesSearch && matchesFilter;
  });

  const actionTypes = ['all', 'client', 'application', 'license', 'database', 'storage', 'backup', 'api_key'];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">سجل النشاطات</h1>
        <p className="text-muted-foreground mt-1">سجل تدقيق العمليات على المنصة</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input placeholder="بحث في السجلات..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
        </div>
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            {actionTypes.map((t) => (
              <SelectItem key={t} value={t}>{t === 'all' ? 'الكل' : t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Logs timeline */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="space-y-3">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center text-muted-foreground py-12">
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد سجلات</p>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((log, idx) => {
                const Icon = getIcon(log.action);
                const color = getActionColor(log.action);
                return (
                  <div key={log.id} className="relative flex gap-4 pb-4">
                    {/* Timeline line */}
                    {idx < filtered.length - 1 && (
                      <div className="absolute right-5 top-12 bottom-0 w-px bg-border" />
                    )}
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      color === 'success' ? 'bg-success/10' :
                      color === 'destructive' ? 'bg-destructive/10' :
                      color === 'warning' ? 'bg-warning/10' :
                      'bg-primary/10'
                    }`}>
                      <Icon className={`w-4.5 h-4.5 ${
                        color === 'success' ? 'text-success' :
                        color === 'destructive' ? 'text-destructive' :
                        color === 'warning' ? 'text-warning' :
                        'text-primary'
                      }`} />
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={color as 'success' | 'destructive' | 'warning' | 'default'} className="font-mono text-xs">
                          {log.action}
                        </Badge>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.created_at).toLocaleString('ar')}
                        </span>
                      </div>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {JSON.stringify(log.details)}
                        </p>
                      )}
                      {log.ip_address && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5 font-mono">
                          IP: {log.ip_address}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
