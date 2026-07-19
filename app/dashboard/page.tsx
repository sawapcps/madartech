'use client';

import { useEffect, useState } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { apiGet } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  AppWindow,
  KeyRound,
  HardDrive,
  TrendingUp,
  TrendingDown,
  Activity,
  Cpu,
  MemoryStick,
  Database as DatabaseIcon,
  Wifi,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';

type Client = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  status: 'active' | 'suspended' | 'deleted';
  storage_limit_mb: number;
  db_limit_mb: number;
  notes?: string | null;
  created_at: string;
};

type AuditLog = {
  id: string;
  action: string;
  entity_type?: string;
  created_at: string;
  details?: Record<string, unknown> | null;
  ip_address?: string | null;
};

type DashboardStats = {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  totalApplications: number;
  activeApplications: number;
  totalLicenses: number;
  activeLicenses: number;
  recentLogs: AuditLog[];
};

// ✅ نوع البيانات الحقيقية من الـ API
type SystemMetric = {
  recorded_at: string;
  cpu_usage: number;
  ram_usage: number;
  storage_usage: number;
  requests_per_min: number;
  error_count: number;
  active_connections: number;
  db_query_avg_ms: number;
};

export default function DashboardPage() {
  return (
    <RouteGuard>
      <DashboardContent />
    </RouteGuard>
  );
}

function DashboardContent() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // ✅ بيانات حقيقية من الـ API
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);
  const [latestMetric, setLatestMetric] = useState<SystemMetric | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [dashStats, recentClients, metricsData] = await Promise.all([
          apiGet<DashboardStats>('/api/admin/dashboard'),
          apiGet<Client[]>('/api/admin/tenants'),
          apiGet<{ data: SystemMetric[]; latest: SystemMetric }>('/api/admin/metrics'),
        ]);
        
        setStats(dashStats);
        setClients(recentClients);
        setLogs(dashStats.recentLogs ?? []);
        
        // ✅ تعيين البيانات الحقيقية
        if (metricsData) {
          setMetrics(metricsData.data || []);
          setLatestMetric(metricsData.latest || null);
        }
      } catch (error) {
        console.error('❌ Error loading dashboard:', error);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const activeClients = stats?.activeTenants ?? 0;
  const suspendedClients = stats?.suspendedTenants ?? 0;
  const activeLicenses = stats?.activeLicenses ?? 0;
  const totalLicenses = stats?.totalLicenses ?? 0;
  const totalStorageLimit = clients.reduce((sum, c) => sum + (c.storage_limit_mb ?? 0), 0);

  // ✅ استخدام البيانات الحقيقية للرسوم البيانية
  const chartData = metrics.length > 0 ? metrics.map((m) => ({
    time: new Date(m.recorded_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
    cpu: Number(m.cpu_usage) || 0,
    ram: Number(m.ram_usage) || 0,
    storage: Number(m.storage_usage) || 0,
    requests: m.requests_per_min || 0,
    errors: m.error_count || 0,
  })) : [];

  const statsArr = [
    {
      label: 'إجمالي العملاء',
      value: stats?.totalTenants ?? 0,
      sub: `${activeClients} نشط، ${suspendedClients} متوقف`,
      icon: Users,
      color: 'text-primary',
      bg: 'bg-primary/10',
      trend: '+2',
      trendUp: true,
    },
    {
      label: 'التطبيقات',
      value: stats?.totalApplications ?? 0,
      sub: `${stats?.activeApplications ?? 0} نشط`,
      icon: AppWindow,
      color: 'text-success',
      bg: 'bg-success/10',
      trend: '+1',
      trendUp: true,
    },
    {
      label: 'التراخيص النشطة',
      value: activeLicenses,
      sub: `من ${totalLicenses} ترخيص`,
      icon: KeyRound,
      color: 'text-warning',
      bg: 'bg-warning/10',
      trend: '+5',
      trendUp: true,
    },
    {
      label: 'مساحة التخزين',
      value: `${(totalStorageLimit / 1024).toFixed(1)} GB`,
      sub: 'إجمالي الحصة المخصصة',
      icon: HardDrive,
      color: 'text-chart-5',
      bg: 'bg-chart-5/10',
      trend: '-0.5%',
      trendUp: false,
    },
  ];

  // ✅ عناصر حالة النظام من البيانات الحقيقية
  const systemHealthItems = latestMetric ? [
    { label: 'المعالج', value: `${Number(latestMetric.cpu_usage).toFixed(1)}%`, icon: Cpu, color: 'text-chart-1' },
    { label: 'الذاكرة', value: `${Number(latestMetric.ram_usage).toFixed(1)}%`, icon: MemoryStick, color: 'text-chart-2' },
    { label: 'التخزين', value: `${Number(latestMetric.storage_usage).toFixed(1)}%`, icon: HardDrive, color: 'text-chart-3' },
    { label: 'الاتصالات النشطة', value: latestMetric.active_connections || 0, icon: Wifi, color: 'text-chart-4' },
    { label: 'متوسط استعلامات DB', value: `${Number(latestMetric.db_query_avg_ms).toFixed(1)}ms`, icon: DatabaseIcon, color: 'text-chart-5' },
    { label: 'أخطاء', value: latestMetric.error_count || 0, icon: AlertTriangle, color: 'text-destructive' },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">لوحة التحكم</h1>
        <p className="text-muted-foreground mt-1">نظرة عامة على المنصة والأداء</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-20" />
                </CardContent>
              </Card>
            ))
          : statsArr.map((stat) => (
              <Card key={stat.label} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className={`w-11 h-11 rounded-xl ${stat.bg} flex items-center justify-center`}>
                      <stat.icon className={`w-5.5 h-5.5 ${stat.color}`} />
                    </div>
                    <div className={`flex items-center gap-1 text-xs font-medium ${stat.trendUp ? 'text-success' : 'text-destructive'}`}>
                      {stat.trendUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                      {stat.trend}
                    </div>
                  </div>
                  <p className="text-3xl font-bold mt-4">{stat.value}</p>
                  <p className="text-sm font-medium text-muted-foreground mt-1">{stat.label}</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{stat.sub}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* CPU & RAM chart */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">أداء النظام</CardTitle>
                <CardDescription>استخدام المعالج والذاكرة (آخر 24 ساعة)</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-chart-1" />
                  المعالج
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-chart-2" />
                  الذاكرة
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[260px]" />
            ) : chartData.length === 0 ? (
              <div className="h-[260px] flex items-center justify-center text-muted-foreground">
                لا توجد بيانات كافية
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="cpuGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="ramGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Area type="monotone" dataKey="cpu" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#cpuGrad)" />
                  <Area type="monotone" dataKey="ram" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#ramGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* System health mini-cards */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">حالة النظام</CardTitle>
            <CardDescription>القيم الحالية</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading || !latestMetric ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)
            ) : (
              systemHealthItems.map((item) => (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center">
                    <item.icon className={`w-4.5 h-4.5 ${item.color}`} />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">{item.label}</p>
                    <p className="text-sm font-semibold">{item.value}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Requests chart + Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Requests per minute */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">الطلبات في الدقيقة</CardTitle>
                <CardDescription>عدد الطلبات والأخطاء</CardDescription>
              </div>
              <Activity className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px]" />
            ) : chartData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                لا توجد بيانات كافية
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--popover))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="requests" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">آخر النشاطات</CardTitle>
            <CardDescription>سجل العمليات الأخيرة</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 mb-2" />)
            ) : logs.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-4">
                لا توجد سجلات
              </div>
            ) : (
              <div className="space-y-3">
                {logs.slice(0, 6).map((log, i) => (
                  <div key={log.id ?? i} className="flex items-start gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('ar')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent clients table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">أحدث العملاء</CardTitle>
          <CardDescription>آخر العملاء المضافين</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-32" />
          ) : clients.length === 0 ? (
            <div className="text-center text-muted-foreground text-sm py-4">
              لا يوجد عملاء
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">الشركة</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">البريد</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right py-3 px-2 font-medium text-muted-foreground">تاريخ الإضافة</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.slice(0, 5).map((client) => (
                    <tr key={client.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-2 font-medium">{client.name}</td>
                      <td className="py-3 px-2 text-muted-foreground">{client.company ?? '-'}</td>
                      <td className="py-3 px-2 text-muted-foreground">{client.email}</td>
                      <td className="py-3 px-2">
                        <Badge variant={client.status === 'active' ? 'success' : client.status === 'suspended' ? 'warning' : 'destructive'}>
                          {client.status === 'active' ? 'نشط' : client.status === 'suspended' ? 'متوقف' : 'محذوف'}
                        </Badge>
                      </td>
                      <td className="py-3 px-2 text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString('ar')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}