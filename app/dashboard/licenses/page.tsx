'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { KeyRound, Plus, MoreVertical, Ban, CheckCircle, Trash2, Copy, Monitor, Calendar, Search } from 'lucide-react';
import { toast } from 'sonner';

// Inline types — no longer imported from @/lib/supabase/client
type Client = {
  id: string;
  name: string;
  email: string;
  status: string;
  created_at: string;
};

type Application = {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
};

// The API returns flat rows with tenant_name / application_name (not nested objects)
type License = {
  id: string;
  license_key: string;
  tenant_id: string;
  application_id: string;
  tenant_name?: string;
  application_name?: string;
  application_slug?: string;
  start_date: string;
  end_date: string;
  max_devices: number;
  status: 'active' | 'suspended' | 'expired' | 'revoked';
  created_at: string;
};

type LicenseDevice = {
  id: string;
  license_id: string;
  device_name: string;
  device_fingerprint: string;
  last_seen_at: string;
  created_at: string;
};

export default function LicensesPage() {
  return (
    <RouteGuard>
      <LicensesContent />
    </RouteGuard>
  );
}

function LicensesContent() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<License | null>(null);
  const [devicesDialog, setDevicesDialog] = useState<License | null>(null);
  const [devices, setDevices] = useState<LicenseDevice[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(false);

  const [formData, setFormData] = useState({
    tenant_id: '',
    application_id: '',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    max_devices: 1,
  });

  const fetchLicenses = useCallback(async () => {
    try {
      const data = await apiGet<License[]>('/api/admin/licenses');
      setLicenses(data ?? []);
    } catch {
      toast.error('فشل تحميل التراخيص');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [c, a] = await Promise.all([
          apiGet<Client[]>('/api/admin/tenants'),
          apiGet<Application[]>('/api/admin/applications'),
        ]);
        setClients(c ?? []);
        setApplications((a ?? []).filter((app) => app.status === 'active'));
      } catch {
        // non-fatal
      }
    })();
    fetchLicenses();
  }, [fetchLicenses]);

  const handleSave = async () => {
    if (!formData.tenant_id || !formData.application_id || !formData.end_date) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      await apiPost('/api/admin/licenses', {
        tenant_id: formData.tenant_id,
        application_id: formData.application_id,
        start_date: formData.start_date,
        end_date: formData.end_date,
        max_devices: formData.max_devices,
      });
      toast.success('تم إنشاء الترخيص بنجاح');
      setDialogOpen(false);
      setFormData({ tenant_id: '', application_id: '', start_date: new Date().toISOString().split('T')[0], end_date: '', max_devices: 1 });
      fetchLicenses();
    } catch {
      toast.error('فشل إنشاء الترخيص');
    }
  };

  const toggleStatus = async (license: License) => {
    const newStatus = license.status === 'active' ? 'suspended' : 'active';
    try {
      // PUT route not yet available — use POST with action field
      await apiPost('/api/admin/licenses', {
        action: 'update',
        id: license.id,
        status: newStatus,
      });
      toast.success(newStatus === 'active' ? 'تم تفعيل الترخيص' : 'تم إيقاف الترخيص');
      fetchLicenses();
    } catch {
      toast.error('فشل تحديث حالة الترخيص');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/admin/licenses?id=${deleteTarget.id}`);
      toast.success('تم حذف الترخيص');
      setDeleteTarget(null);
      fetchLicenses();
    } catch {
      toast.error('فشل حذف الترخيص');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('تم نسخ مفتاح الترخيص');
  };

  const openDevices = async (license: License) => {
    setDevicesDialog(license);
    setDevicesLoading(true);
    // Devices route not yet available — show empty state
    setDevices([]);
    setDevicesLoading(false);
  };

  const removeDevice = async (deviceId: string) => {
    try {
      await apiDelete(`/api/admin/licenses/devices?id=${deviceId}`);
      toast.success('تم حذف الجهاز');
      if (devicesDialog) openDevices(devicesDialog);
    } catch {
      toast.error('فشل حذف الجهاز');
    }
  };

  const filtered = licenses.filter((l) =>
    l.license_key.includes(search) ||
    (l.tenant_name ?? '').includes(search) ||
    (l.application_name ?? '').includes(search)
  );

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: 'success' | 'warning' | 'destructive' | 'default'; label: string }> = {
      active: { variant: 'success', label: 'نشط' },
      suspended: { variant: 'warning', label: 'متوقف' },
      expired: { variant: 'destructive', label: 'منتهي' },
      revoked: { variant: 'destructive', label: 'ملغى' },
    };
    const cfg = map[status] ?? { variant: 'default' as const, label: status };
    return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة التراخيص</h1>
          <p className="text-muted-foreground mt-1">مفاتيح الترخيص الصادرة للعملاء</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إنشاء ترخيص
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
        <Input placeholder="بحث بمفتاح الترخيص أو العميل أو التطبيق..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-10" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد تراخيص</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">مفتاح الترخيص</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">التطبيق</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الأجهزة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">تاريخ الانتهاء</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((license) => {
                    const isExpired = new Date(license.end_date) < new Date();
                    return (
                      <tr key={license.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{license.license_key}</code>
                            <button onClick={() => copyKey(license.license_key)} className="text-muted-foreground hover:text-primary transition-colors">
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-medium">{license.tenant_name ?? '-'}</td>
                        <td className="py-3 px-4 text-muted-foreground">{license.application_name ?? '-'}</td>
                        <td className="py-3 px-4">
                          <button onClick={() => openDevices(license)} className="flex items-center gap-1 text-primary hover:underline">
                            <Monitor className="w-4 h-4" />
                            <span className="text-xs">عرض الأجهزة</span>
                          </button>
                        </td>
                        <td className="py-3 px-4">
                          <span className={isExpired ? 'text-destructive' : 'text-muted-foreground'}>
                            {new Date(license.end_date).toLocaleDateString('ar')}
                          </span>
                        </td>
                        <td className="py-3 px-4">{statusBadge(isExpired && license.status === 'active' ? 'expired' : license.status)}</td>
                        <td className="py-3 px-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start">
                              <DropdownMenuItem onClick={() => toggleStatus(license)}>
                                {license.status === 'active' ? <Ban className="w-4 h-4 ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                                {license.status === 'active' ? 'إيقاف' : 'تفعيل'}
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(license)}>
                                <Trash2 className="w-4 h-4 ml-2" />
                                حذف
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Create dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء ترخيص جديد</DialogTitle>
            <DialogDescription>سيتم توليد مفتاح ترخيص تلقائياً</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>العميل *</Label>
              <Select value={formData.tenant_id} onValueChange={(v) => setFormData({ ...formData, tenant_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>التطبيق *</Label>
              <Select value={formData.application_id} onValueChange={(v) => setFormData({ ...formData, application_id: v })}>
                <SelectTrigger><SelectValue placeholder="اختر التطبيق" /></SelectTrigger>
                <SelectContent>
                  {applications.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الانتهاء *</Label>
                <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>عدد الأجهزة المسموح بها</Label>
              <Input type="number" min={1} value={formData.max_devices} onChange={(e) => setFormData({ ...formData, max_devices: Number(e.target.value) })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>إنشاء الترخيص</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Devices dialog */}
      <Dialog open={!!devicesDialog} onOpenChange={(open) => !open && setDevicesDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>الأجهزة المسجلة</DialogTitle>
            <DialogDescription>
              {devicesDialog?.tenant_name} — {devicesDialog?.application_name}
            </DialogDescription>
          </DialogHeader>
          {devicesLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : devices.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center p-6">لا توجد أجهزة مسجلة لهذا الترخيص</p>
          ) : (
            <div className="space-y-2">
              {devices.map((d) => (
                <div key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <div>
                    <p className="text-sm font-medium">{d.device_name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{d.device_fingerprint}</p>
                    <p className="text-xs text-muted-foreground">آخر ظهور: {new Date(d.last_seen_at).toLocaleString('ar')}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeDevice(d.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDevicesDialog(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الترخيص</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف هذا الترخيص؟ لا يمكن التراجع عن هذا الإجراء.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
