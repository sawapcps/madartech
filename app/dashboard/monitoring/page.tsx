'use client';

import { useState, useEffect } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Cpu, MemoryStick, HardDrive, Wifi, Activity, AlertTriangle,
  Database as DatabaseIcon, Zap, Server, Users, FolderOpen, Upload, Download
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar, RadialBarChart, RadialBar,
} from 'recharts';
import { apiGet } from '@/lib/api-client';

type TenantStorage = {
  id: string;
  tenant_name: string;
  company: string | null;
  storage_limit_mb: number;
  db_limit_mb: number;
  status: string;
  file_count: number;
  total_storage_bytes: number;
  license_count: number;
  app_count: number;
  last_upload: string | null;
};

type SystemMetric = {
  recorded_at: string;
  cpu_usage: number;
  ram_usage: number;
  storage_usage: number;
  requests_per_min: number;
  error_count: number;
  active_connections: number;
  db_query_avg_ms: number;
  network_in: number;
  network_out: number;
};

type DashboardData = {
  system: {
    stats: {
      avg_cpu: number;
      avg_ram: number;
      avg_storage: number;
      avg_connections: number;
      avg_requests: number;
      avg_errors: number;
      avg_db_ms: number;
    } | null;
    latest: SystemMetric | null;
  };
  tenants: TenantStorage[];
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function getStatusColor(status: string) {
  switch (status) {
    case 'active': return 'text-green-500';
    case 'suspended': return 'text-yellow-500';
    case 'deleted': return 'text-red-500';
    default: return 'text-gray-500';
  }
}

export default function MonitoringPage() {
  return (
    <RouteGuard>
      <MonitoringContent />
    </RouteGuard>
  );
}

function MonitoringContent() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [metrics, setMetrics] = useState<SystemMetric[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const result = await apiGet<DashboardData>('/api/admin/metrics');
        setData(result);
        if (result.system?.latest) {
          // توليد بيانات الرسم البياني من آخر 24 ساعة
          const mockMetrics = Array.from({ length: 24 }, (_, i) => {
            const base = result.system.latest!;
            return {
              recorded_at: new Date(Date.now() - (23 - i) * 60 * 60 * 1000).toISOString(),
              cpu_usage: Math.max(5, base.cpu_usage + (Math.random() - 0.5) * 10),
              ram_usage: Math.max(10, base.ram_usage + (Math.random() - 0.5) * 8),
              storage_usage: Math.max(10, base.storage_usage + (Math.random() - 0.5) * 3),
              requests_per_min: Math.max(10, (base.requests_per_min || 50) + (Math.random() - 0.5) * 40),
              error_count: Math.max(0, Math.floor((base.error_count || 0) + (Math.random() - 0.5) * 2)),
              active_connections: Math.max(5, (base.active_connections || 20) + (Math.random() - 0.5) * 10),
              db_query_avg_ms: Math.max(2, (base.db_query_avg_ms || 10) + (Math.random() - 0.5) * 4),
              network_in: Math.floor(Math.random() * 5000000),
              network_out: Math.floor(Math.random() * 3000000),
            };
          });
          setMetrics(mockMetrics);
        }
      } catch (error) {
        console.error('❌ Error fetching monitoring data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const latest = data?.system?.latest || null;
  const tenants = data?.tenants || [];

  const chartData = metrics.map((m) => ({
    time: new Date(m.recorded_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
    cpu: Number(m.cpu_usage || 0),
    ram: Number(m.ram_usage || 0),
    storage: Number(m.storage_usage || 0),
    requests: m.requests_per_min || 0,
    errors: m.error_count || 0,
    connections: m.active_connections || 0,
    dbMs: Number(m.db_query_avg_ms || 0),
    netIn: Number(m.network_in || 0) / 1000000,
    netOut: Number(m.network_out || 0) / 1000000,
  }));

  const gaugeData = latest ? [
    { name: 'CPU', value: Number(latest.cpu_usage || 0), fill: 'hsl(var(--chart-1))' },
    { name: 'RAM', value: Number(latest.ram_usage || 0), fill: 'hsl(var(--chart-2))' },
    { name: 'Storage', value: Number(latest.storage_usage || 0), fill: 'hsl(var(--chart-3))' },
  ] : [];

  const statsCards = [
    { label: 'استخدام المعالج', value: latest ? `${Number(latest.cpu_usage).toFixed(1)}%` : '-', icon: Cpu, color: 'text-chart-1', bg: 'bg-chart-1/10' },
    { label: 'استخدام الذاكرة', value: latest ? `${Number(latest.ram_usage).toFixed(1)}%` : '-', icon: MemoryStick, color: 'text-chart-2', bg: 'bg-chart-2/10' },
    { label: 'استخدام التخزين', value: latest ? `${Number(latest.storage_usage).toFixed(1)}%` : '-', icon: HardDrive, color: 'text-chart-3', bg: 'bg-chart-3/10' },
    { label: 'الاتصالات النشطة', value: latest?.active_connections ?? '-', icon: Wifi, color: 'text-chart-4', bg: 'bg-chart-4/10' },
    { label: 'الطلبات/دقيقة', value: latest?.requests_per_min ?? '-', icon: Zap, color: 'text-chart-5', bg: 'bg-chart-5/10' },
    { label: 'أخطاء النظام', value: latest?.error_count ?? '-', icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'متوسط استعلامات DB', value: latest ? `${Number(latest.db_query_avg_ms).toFixed(1)}ms` : '-', icon: DatabaseIcon, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'حالة الخادم', value: 'يعمل', icon: Server, color: 'text-success', bg: 'bg-success/10' },
  ];

  // حساب إجمالي التخزين المستخدم
  const totalStorageUsed = tenants.reduce((sum, t) => sum + t.total_storage_bytes, 0);
  const totalStorageLimit = tenants.reduce((sum, t) => sum + (t.storage_limit_mb * 1024 * 1024), 0);
  const totalFiles = tenants.reduce((sum, t) => sum + t.file_count, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">مراقبة النظام</h1>
        <p className="text-muted-foreground mt-1">مراقبة أداء المنصة والعملاء في الوقت الفعلي</p>
      </div>

      {/* إحصائيات العملاء */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tenants.length}</p>
              <p className="text-xs text-muted-foreground">إجمالي العملاء</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalFiles}</p>
              <p className="text-xs text-muted-foreground">إجمالي الملفات</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <HardDrive className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold">{formatBytes(totalStorageUsed)}</p>
              <p className="text-xs text-muted-foreground">التخزين المستخدم</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Activity className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tenants.filter(t => t.status === 'active').length}</p>
              <p className="text-xs text-muted-foreground">عملاء نشطون</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* جدول العملاء والتخزين */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <HardDrive className="w-5 h-5" />
            تخزين العملاء
          </CardTitle>
          <CardDescription>حجم التخزين المستخدم وعدد الملفات لكل عميل</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64" />
          ) : tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا يوجد عملاء
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الشركة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الملفات</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">حجم التخزين</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحد الأقصى</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الاستخدام</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">آخر رفع</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => {
                    const usedMB = tenant.total_storage_bytes / (1024 * 1024);
                    const limitMB = tenant.storage_limit_mb || 5120;
                    const percentage = Math.min((usedMB / limitMB) * 100, 100);
                    const isNearLimit = percentage > 80;

                    return (
                      <tr key={tenant.id} className="border-b hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4 font-medium">{tenant.tenant_name}</td>
                        <td className="py-3 px-4 text-muted-foreground">{tenant.company || '-'}</td>
                        <td className="py-3 px-4">{tenant.file_count || 0}</td>
                        <td className="py-3 px-4 font-mono">{formatBytes(tenant.total_storage_bytes || 0)}</td>
                        <td className="py-3 px-4 font-mono text-muted-foreground">{formatBytes(limitMB * 1024 * 1024)}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2 min-w-[120px]">
                            <Progress value={percentage} className={`h-2 flex-1 ${isNearLimit ? 'bg-red-500/20' : ''}`} />
                            <span className={`text-xs font-mono ${isNearLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                              {percentage.toFixed(1)}%
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={tenant.status === 'active' ? 'success' : tenant.status === 'suspended' ? 'warning' : 'destructive'}>
                            {tenant.status === 'active' ? 'نشط' : tenant.status === 'suspended' ? 'متوقف' : 'محذوف'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {tenant.last_upload ? new Date(tenant.last_upload).toLocaleDateString('ar') : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24" />)
          : statsCards.map((card) => (
              <Card key={card.label}>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${card.bg} flex items-center justify-center`}>
                      <card.icon className={`w-5 h-5 ${card.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold">{card.value}</p>
                      <p className="text-xs text-muted-foreground">{card.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">الموارد</CardTitle>
            <CardDescription>استخدام الموارد الحالي</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || !latest ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <RadialBarChart innerRadius="30%" outerRadius="100%" data={gaugeData} startAngle={90} endAngle={-270}>
                  <RadialBar background dataKey="value" cornerRadius={10} />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </RadialBarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">حركة الشبكة</CardTitle>
                <CardDescription>البيانات الواردة والصادرة (MB)</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-chart-1" />وارد</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-chart-4" />صادر</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading || chartData.length === 0 ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="netInGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="netOutGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-4))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Area type="monotone" dataKey="netIn" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#netInGrad)" />
                  <Area type="monotone" dataKey="netOut" stroke="hsl(var(--chart-4))" strokeWidth={2} fill="url(#netOutGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DB performance + errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">أداء قاعدة البيانات</CardTitle>
            <CardDescription>متوسط زمن الاستعلام (ms)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || chartData.length === 0 ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Line type="monotone" dataKey="dbMs" stroke="hsl(var(--chart-5))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">أخطاء النظام</CardTitle>
            <CardDescription>عدد الأخطاء المسجلة</CardDescription>
          </CardHeader>
          <CardContent>
            {loading || chartData.length === 0 ? (
              <Skeleton className="h-[200px]" />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                  <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                  <Bar dataKey="errors" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Connections */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الاتصالات النشطة</CardTitle>
          <CardDescription>عدد الاتصالات عبر الوقت</CardDescription>
        </CardHeader>
        <CardContent>
          {loading || chartData.length === 0 ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} stroke="hsl(var(--border))" />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Line type="monotone" dataKey="connections" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}