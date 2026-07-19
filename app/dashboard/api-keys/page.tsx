'use client';

import { useEffect, useState, useCallback } from 'react';
import { RouteGuard } from '@/components/route-guard';
import { apiGet, apiPost, apiDelete } from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { KeyRound, Plus, MoreVertical, Trash2, Copy, Ban, CheckCircle, Clock } from 'lucide-react';
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

// The API returns flat rows with tenant_name / application_name (not nested client object)
type ApiKey = {
  id: string;
  name: string;
  key_prefix: string;
  tenant_id: string;
  application_id?: string | null;
  tenant_name?: string;
  application_name?: string | null;
  permissions?: Record<string, boolean> | string | null;
  status: 'active' | 'revoked';
  last_used_at?: string | null;
  expires_at?: string | null;
  created_at: string;
};

export default function ApiKeysPage() {
  return (
    <RouteGuard>
      <ApiKeysContent />
    </RouteGuard>
  );
}

function ApiKeysContent() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ApiKey | null>(null);
  const [newKeyDisplay, setNewKeyDisplay] = useState<string | null>(null);
  const [createData, setCreateData] = useState({ tenant_id: '', application_id: '', name: '', expires_at: '' });

  const fetchApiKeys = useCallback(async () => {
    try {
      const data = await apiGet<ApiKey[]>('/api/admin/api-keys');
      setApiKeys(data ?? []);
    } catch {
      toast.error('فشل تحميل مفاتيح API');
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
    fetchApiKeys();
  }, [fetchApiKeys]);

  const handleCreate = async () => {
    if (!createData.tenant_id || !createData.name) {
      toast.error('يرجى تعبئة جميع الحقول المطلوبة');
      return;
    }

    try {
      // The API generates and returns the full key in meta.full_key
      const res = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: createData.tenant_id,
          application_id: createData.application_id || null,
          name: createData.name,
          expires_at: createData.expires_at || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Request failed');

      const fullKey = (json.meta?.full_key as string) ?? '';
      setNewKeyDisplay(fullKey || 'مفتاح تم إنشاؤه (راجع السجل)');
      setDialogOpen(false);
      setCreateData({ tenant_id: '', application_id: '', name: '', expires_at: '' });
      fetchApiKeys();
      toast.success('تم إنشاء مفتاح API');
    } catch {
      toast.error('فشل إنشاء مفتاح API');
    }
  };

  const revokeKey = async (apiKey: ApiKey) => {
    try {
      // PUT route not yet available — use POST with action field
      await apiPost('/api/admin/api-keys', {
        action: 'update',
        id: apiKey.id,
        status: 'revoked',
      });
      toast.success('تم إلغاء المفتاح');
      fetchApiKeys();
    } catch {
      toast.error('فشل إلغاء المفتاح');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await apiDelete(`/api/admin/api-keys?id=${deleteTarget.id}`);
      toast.success('تم حذف المفتاح');
      setDeleteTarget(null);
      fetchApiKeys();
    } catch {
      toast.error('فشل حذف المفتاح');
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    toast.success('تم نسخ المعرّف');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">مفاتيح API</h1>
          <p className="text-muted-foreground mt-1">مفاتيح وصول العملاء للواجهات البرمجية</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إنشاء مفتاح
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : apiKeys.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <KeyRound className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد مفاتيح API</p>
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الاسم</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">العميل</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">التطبيق</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">المعرّف</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">آخر استخدام</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الانتهاء</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">الحالة</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {apiKeys.map((apiKey) => (
                    <tr key={apiKey.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-medium">{apiKey.name}</td>
                      <td className="py-3 px-4 text-muted-foreground">{apiKey.tenant_name ?? '-'}</td>
                      <td className="py-3 px-4 text-muted-foreground">{apiKey.application_name ?? '-'}</td>
                      <td className="py-3 px-4">
                        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">{apiKey.key_prefix}...</code>
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {apiKey.last_used_at ? new Date(apiKey.last_used_at).toLocaleDateString('ar') : 'لم يستخدم'}
                      </td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {apiKey.expires_at ? new Date(apiKey.expires_at).toLocaleDateString('ar') : 'لا يوجد'}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={apiKey.status === 'active' ? 'success' : 'destructive'}>
                          {apiKey.status === 'active' ? 'نشط' : 'ملغى'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            <DropdownMenuItem onClick={() => copyKey(apiKey.key_prefix)}>
                              <Copy className="w-4 h-4 ml-2" />
                              نسخ المعرّف
                            </DropdownMenuItem>
                            {apiKey.status === 'active' && (
                              <DropdownMenuItem onClick={() => revokeKey(apiKey)}>
                                <Ban className="w-4 h-4 ml-2" />
                                إلغاء المفتاح
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget(apiKey)}>
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

      {/* Create dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setDialogOpen(false)}>
          <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">إنشاء مفتاح API جديد</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>العميل *</Label>
                <Select value={createData.tenant_id} onValueChange={(v) => setCreateData({ ...createData, tenant_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>التطبيق (اختياري)</Label>
                <Select value={createData.application_id} onValueChange={(v) => setCreateData({ ...createData, application_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر التطبيق" /></SelectTrigger>
                  <SelectContent>
                    {applications.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>اسم المفتاح *</Label>
                <Input value={createData.name} onChange={(e) => setCreateData({ ...createData, name: e.target.value })} placeholder="مفتاح الإنتاج" />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الانتهاء (اختياري)</Label>
                <Input type="date" value={createData.expires_at} onChange={(e) => setCreateData({ ...createData, expires_at: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
              <Button onClick={handleCreate}>إنشاء</Button>
            </div>
          </div>
        </div>
      )}

      {/* New key display dialog */}
      {newKeyDisplay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setNewKeyDisplay(null)}>
          <div className="w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 mb-4">
              <CheckCircle className="w-5 h-5 text-success" />
              <h2 className="text-lg font-semibold">تم إنشاء المفتاح</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              انسخ المفتاح الآن — لن تتمكن من رؤيته مرة أخرى.
            </p>
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
              <code className="text-sm font-mono flex-1 break-all">{newKeyDisplay}</code>
              <Button variant="ghost" size="icon" onClick={() => copyKey(newKeyDisplay)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setNewKeyDisplay(null)}>تم</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>حذف مفتاح API</AlertDialogTitle>
            <AlertDialogDescription>هل أنت متأكد من حذف &quot;{deleteTarget?.name}&quot;؟</AlertDialogDescription>
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
