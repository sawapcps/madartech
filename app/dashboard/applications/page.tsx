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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { AppWindow, Plus, MoreVertical, Pencil, Trash2, Users, Tag } from 'lucide-react';
import { toast } from 'sonner';

// Inline types — no longer imported from @/lib/supabase/client
type Application = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  version: string;
  status: 'active' | 'draft' | 'deprecated';
  created_at: string;
  updated_at?: string;
};

export default function ApplicationsPage() {
  return (
    <RouteGuard>
      <ApplicationsContent />
    </RouteGuard>
  );
}

function ApplicationsContent() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [subscriptions, setSubscriptions] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<Application | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Application | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    version: '1.0.0',
    status: 'active' as Application['status'],
  });

  const fetchApplications = useCallback(async () => {
    try {
      const data = await apiGet<Application[]>('/api/admin/applications');
      setApplications(data ?? []);
      // Subscription counts not available via current API — show 0
      setSubscriptions({});
    } catch {
      toast.error('فشل تحميل التطبيقات');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const slugify = (text: string) => text.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');

  const openAddDialog = () => {
    setEditingApp(null);
    setFormData({ name: '', slug: '', description: '', version: '1.0.0', status: 'active' });
    setDialogOpen(true);
  };

  const openEditDialog = (app: Application) => {
    setEditingApp(app);
    setFormData({
      name: app.name,
      slug: app.slug,
      description: app.description ?? '',
      version: app.version,
      status: app.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.slug) {
      toast.error('الاسم والمعرّف مطلوبان');
      return;
    }

    try {
      if (editingApp) {
        // PUT route not yet available — use POST with action field
        await apiPost('/api/admin/applications', {
          action: 'update',
          id: editingApp.id,
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          version: formData.version,
          status: formData.status,
        });
        toast.success('تم تحديث التطبيق');
      } else {
        await apiPost('/api/admin/applications', {
          name: formData.name,
          slug: formData.slug,
          description: formData.description || null,
          version: formData.version,
          status: formData.status,
        });
        toast.success('تم إضافة التطبيق');
      }
      setDialogOpen(false);
      fetchApplications();
    } catch (err) {
      toast.error(err instanceof Error && err.message.includes('duplicate') ? 'المعرّف مستخدم بالفعل' : 'فشل حفظ التطبيق');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/admin/applications?id=${deleteTarget.id}`);
      toast.success('تم حذف التطبيق');
      setDeleteTarget(null);
      fetchApplications();
    } catch {
      toast.error('فشل حذف التطبيق');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة التطبيقات</h1>
          <p className="text-muted-foreground mt-1">التطبيقات المتاحة للبيع للعملاء</p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="w-4 h-4 ml-2" />
          إضافة تطبيق
        </Button>
      </div>

      {/* Grid of application cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-48" />)}
        </div>
      ) : applications.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <AppWindow className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لا توجد تطبيقات</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {applications.map((app) => (
            <Card key={app.id} className="hover:shadow-lg transition-shadow group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <AppWindow className="w-6 h-6 text-primary" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem onClick={() => openEditDialog(app)}>
                        <Pencil className="w-4 h-4 ml-2" />
                        تعديل
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(app)}>
                        <Trash2 className="w-4 h-4 ml-2" />
                        حذف
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-bold text-lg mt-4">{app.name}</h3>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2 min-h-[2.5rem]">{app.description ?? 'لا يوجد وصف'}</p>

                <div className="flex items-center gap-2 mt-4 flex-wrap">
                  <Badge variant="outline" className="font-mono">
                    <Tag className="w-3 h-3 ml-1" />
                    v{app.version}
                  </Badge>
                  <Badge variant={app.status === 'active' ? 'success' : app.status === 'deprecated' ? 'destructive' : 'warning'}>
                    {app.status === 'active' ? 'نشط' : app.status === 'deprecated' ? 'متوقف' : 'مسودة'}
                  </Badge>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span>{subscriptions[app.id] ?? 0} عميل</span>
                  </div>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">{app.slug}</code>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>{editingApp ? 'تعديل التطبيق' : 'إضافة تطبيق جديد'}</DialogTitle>
            <DialogDescription>
              {editingApp ? 'تحديث بيانات التطبيق' : 'إضافة تطبيق جديد للبيع للعملاء'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم التطبيق *</Label>
              <Input
                value={formData.name}
                onChange={(e) => {
                  setFormData({ ...formData, name: e.target.value, slug: editingApp ? formData.slug : slugify(e.target.value) });
                }}
                placeholder="برنامج المحاسبة"
              />
            </div>
            <div className="space-y-2">
              <Label>المعرّف (Slug) *</Label>
              <Input value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: slugify(e.target.value) })} placeholder="accounting" className="font-mono" />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف مختصر للتطبيق..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الإصدار</Label>
                <Input value={formData.version} onChange={(e) => setFormData({ ...formData, version: e.target.value })} placeholder="1.0.0" />
              </div>
              <div className="space-y-2">
                <Label>الحالة</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v as Application['status'] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="draft">مسودة</SelectItem>
                    <SelectItem value="deprecated">متوقف</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editingApp ? 'حفظ التغييرات' : 'إضافة التطبيق'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التطبيق</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف &quot;{deleteTarget?.name}&quot;؟ سيتم إلغاء جميع اشتراكات العملاء المرتبطة به.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
