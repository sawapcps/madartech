'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Pencil,
  Trash2,
  Ban,
  CheckCircle,
  Mail,
  Phone,
  Building2,
  HardDrive,
  Database,
  Archive,
  AppWindow,
} from 'lucide-react';
import { toast } from 'sonner';

// Inline types — no longer imported from @/lib/supabase/client
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

type Application = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  version: string;
  status: 'active' | 'draft' | 'deprecated';
  created_at: string;
};

type ClientApplication = {
  id: string;
  application?: { name?: string } | null;
  status: string;
};

type Backup = {
  id: string;
  type: 'auto' | 'manual';
  status: 'completed' | 'failed' | 'pending' | 'running';
  created_at: string;
};

export default function ClientsPage() {
  return (
    <RouteGuard>
      <ClientsContent />
    </RouteGuard>
  );
}

function ClientsContent() {
  const [clients, setClients] = useState<Client[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [clientApps, setClientApps] = useState<ClientApplication[]>([]);
  const [clientBackups, setClientBackups] = useState<Backup[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    status: 'active' as 'active' | 'suspended' | 'deleted',
    storage_limit_mb: 5120,
    db_limit_mb: 1024,
    notes: '',
  });

  const fetchClients = useCallback(async () => {
    try {
      const data = await apiGet<Client[]>('/api/admin/tenants');
      setClients(data ?? []);
    } catch {
      toast.error('فشل تحميل العملاء');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      const data = await apiGet<Application[]>('/api/admin/applications');
      setApplications((data ?? []).filter((a) => a.status === 'active'));
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    fetchClients();
    fetchApplications();
  }, [fetchClients, fetchApplications]);

  const openAddDialog = () => {
    setEditingClient(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      company: '',
      status: 'active',
      storage_limit_mb: 5120,
      db_limit_mb: 1024,
      notes: '',
    });
    setDialogOpen(true);
  };

  const openEditDialog = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      email: client.email,
      phone: client.phone ?? '',
      company: client.company ?? '',
      status: client.status,
      storage_limit_mb: client.storage_limit_mb,
      db_limit_mb: client.db_limit_mb,
      notes: client.notes ?? '',
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      toast.error('الاسم والبريد الإلكتروني مطلوبان');
      return;
    }

    try {
      if (editingClient) {
        // PUT route not yet available — use POST with action field
        await apiPost('/api/admin/tenants', {
          action: 'update',
          id: editingClient.id,
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          company: formData.company || null,
          status: formData.status,
          storage_limit_mb: formData.storage_limit_mb,
          db_limit_mb: formData.db_limit_mb,
          notes: formData.notes || null,
        });
        toast.success('تم تحديث العميل بنجاح');
      } else {
        await apiPost('/api/admin/tenants', {
          name: formData.name,
          email: formData.email,
          phone: formData.phone || null,
          company: formData.company || null,
          status: formData.status,
          storage_limit_mb: formData.storage_limit_mb,
          db_limit_mb: formData.db_limit_mb,
          notes: formData.notes || null,
        });
        toast.success('تم إضافة العميل بنجاح');
      }
      setDialogOpen(false);
      fetchClients();
    } catch (err) {
      toast.error(err instanceof Error && err.message.includes('duplicate') ? 'البريد الإلكتروني مستخدم بالفعل' : 'فشل حفظ العميل');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/admin/tenants?id=${deleteTarget.id}`);
      toast.success('تم حذف العميل');
      setDeleteTarget(null);
      fetchClients();
    } catch {
      toast.error('فشل حذف العميل');
    }
  };

  const toggleStatus = async (client: Client) => {
    const newStatus = client.status === 'active' ? 'suspended' : 'active';
    try {
      await apiPost('/api/admin/tenants', {
        action: 'update',
        id: client.id,
        status: newStatus,
      });
      toast.success(newStatus === 'active' ? 'تم تفعيل العميل' : 'تم إيقاف العميل');
      fetchClients();
    } catch {
      toast.error('فشل تحديث الحالة');
    }
  };

  const openDetail = async (client: Client) => {
    setDetailClient(client);
    setDetailLoading(true);
    // Detail data (apps/backups) not available via current API — show empty state
    setClientApps([]);
    setClientBackups([]);
    setDetailLoading(false);
  };

  const filtered = clients.filter((c) => {
    const matchesSearch = c.name.includes(search) || c.email.includes(search) || (c.company ?? '').includes(search);
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge variant="success">نشط</Badge>;
    if (status === 'suspended') return <Badge variant="warning">متوقف</Badge>;
    return <Badge variant="destructive">محذوف</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة العملاء</h1>
          <p className="text-muted-foreground mt-1">إدارة عملاء المنصة وإعداداتهم</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة عميل
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو البريد أو الشركة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="suspended">متوقف</SelectItem>
            <SelectItem value="deleted">محذوف</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا يوجد عملاء مطابقون</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الشركة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">التخزين</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">قاعدة البيانات</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">تاريخ الإضافة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((client) => (
                    <tr
                      key={client.id}
                      className="border-b last:border-0 hover:bg-muted/30 transition-colors cursor-pointer"
                      onClick={() => openDetail(client)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                            {client.name[0]}
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            <p className="text-xs text-muted-foreground">{client.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">{client.company ?? '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{(client.storage_limit_mb / 1024).toFixed(1)} GB</td>
                      <td className="py-3 px-4 text-muted-foreground">{(client.db_limit_mb / 1024).toFixed(1)} GB</td>
                      <td className="py-3 px-4">{statusBadge(client.status)}</td>
                      <td className="py-3 px-4 text-muted-foreground">{new Date(client.created_at).toLocaleDateString('ar')}</td>
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => openEditDialog(client)}>
                              <Pencil className="w-4 h-4 ml-2" />
                              تعديل
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleStatus(client)}>
                              {client.status === 'active' ? <Ban className="w-4 h-4 ml-2" /> : <CheckCircle className="w-4 h-4 ml-2" />}
                              {client.status === 'active' ? 'إيقاف' : 'تفعيل'}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(client)}>
                              <Trash2 className="w-4 h-4 ml-2" />
                              حذف
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editingClient ? 'تعديل العميل' : 'إضافة عميل جديد'}</DialogTitle>
            <DialogDescription>
              {editingClient ? 'تحديث بيانات العميل' : 'إضافة عميل جديد إلى المنصة'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="الاسم الكامل"
                />
              </div>
              <div className="space-y-2">
                <Label>البريد الإلكتروني *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="client@example.com"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الهاتف</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+966..."
                />
              </div>
              <div className="space-y-2">
                <Label>الشركة</Label>
                <Input
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="اسم الشركة"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>حد التخزين (MB)</Label>
                <Input
                  type="number"
                  value={formData.storage_limit_mb}
                  onChange={(e) => setFormData({ ...formData, storage_limit_mb: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>حد قاعدة البيانات (MB)</Label>
                <Input
                  type="number"
                  value={formData.db_limit_mb}
                  onChange={(e) => setFormData({ ...formData, db_limit_mb: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Client['status'] })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="suspended">متوقف</SelectItem>
                  <SelectItem value="deleted">محذوف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="ملاحظات إضافية..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave}>{editingClient ? 'حفظ التغييرات' : 'إضافة العميل'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailClient} onOpenChange={(open) => !open && setDetailClient(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto scrollbar-thin">
          {detailClient && (
            <>
              <DialogHeader>
                <DialogTitle>تفاصيل العميل</DialogTitle>
                <DialogDescription>{detailClient.name}</DialogDescription>
              </DialogHeader>
              {detailLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-16" />
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {/* Info grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { icon: Mail, label: 'البريد', value: detailClient.email },
                      { icon: Phone, label: 'الهاتف', value: detailClient.phone ?? '-' },
                      { icon: Building2, label: 'الشركة', value: detailClient.company ?? '-' },
                      {
                        icon: CheckCircle,
                        label: 'الحالة',
                        value:
                          detailClient.status === 'active' ? 'نشط' : detailClient.status === 'suspended' ? 'متوقف' : 'محذوف',
                      },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <item.icon className="w-4.5 h-4.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-xs text-muted-foreground">{item.label}</p>
                          <p className="text-sm font-medium">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Storage usage */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <HardDrive className="w-4 h-4 text-muted-foreground" /> التخزين
                      </span>
                      <span className="font-medium">{(detailClient.storage_limit_mb / 1024).toFixed(1)} GB</span>
                    </div>
                    <Progress value={35} className="h-2" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <Database className="w-4 h-4 text-muted-foreground" /> قاعدة البيانات
                      </span>
                      <span className="font-medium">{(detailClient.db_limit_mb / 1024).toFixed(1)} GB</span>
                    </div>
                    <Progress value={22} className="h-2" />
                  </div>

                  {/* Applications */}
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <AppWindow className="w-4 h-4 text-muted-foreground" />
                      التطبيقات المشترك بها ({clientApps.length})
                    </p>
                    {clientApps.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">لا توجد تطبيقات مشترك بها</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {clientApps.map((ca) => (
                          <Badge key={ca.id} variant={ca.status === 'active' ? 'default' : 'warning'}>
                            {ca.application?.name ?? 'غير معروف'}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Recent backups */}
                  <div>
                    <p className="text-sm font-medium mb-2 flex items-center gap-2">
                      <Archive className="w-4 h-4 text-muted-foreground" />
                      آخر النسخ الاحتياطية
                    </p>
                    {clientBackups.length === 0 ? (
                      <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">لا توجد نسخ احتياطية</p>
                    ) : (
                      <div className="space-y-2">
                        {clientBackups.map((b) => (
                          <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 text-sm">
                            <span>{b.type === 'auto' ? 'تلقائي' : 'يدوي'}</span>
                            <Badge variant={b.status === 'completed' ? 'success' : b.status === 'failed' ? 'destructive' : 'warning'}>
                              {b.status === 'completed' ? 'مكتمل' : b.status === 'failed' ? 'فشل' : 'قيد التنفيذ'}
                            </Badge>
                            <span className="text-muted-foreground">{new Date(b.created_at).toLocaleDateString('ar')}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {detailClient.notes && (
                    <div>
                      <p className="text-sm font-medium mb-1">ملاحظات</p>
                      <p className="text-sm text-muted-foreground p-3 rounded-lg bg-muted/30">{detailClient.notes}</p>
                    </div>
                  )}
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailClient(null)}>
                  إغلاق
                </Button>
                <Button
                  onClick={() => {
                    openEditDialog(detailClient);
                    setDetailClient(null);
                  }}
                >
                  <Pencil className="w-4 h-4 ml-2" />
                  تعديل
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف العميل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف &quot;{deleteTarget?.name}&quot;؟ سيتم حذف جميع البيانات المرتبطة بهذا العميل. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
